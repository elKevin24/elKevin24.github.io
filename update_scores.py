import os
import json
import urllib.request
from datetime import datetime, timezone

def parse_kickoff(s):
    # Parsea formatos ISO como '2026-06-16T21:00:00-06:00' en objetos datetime con zona horaria
    return datetime.fromisoformat(s)

def fetch_live_scores(api_key, api_type, date_str):
    # Simulación en Modo Prueba (TEST_MODE)
    if os.environ.get("TEST_MODE") == "true":
        if api_type == "LIVE_SCORE_API":
            print("[TEST_MODE] Simulando respuesta de Live-Score-API...")
            mock_data = {
                "success": True,
                "data": {
                    "match": [
                        {
                            "id": "9999",
                            "home_name": "Austria",
                            "away_name": "Jordan",
                            "score": "1 - 0",
                            "status": "FINISHED"
                        }
                    ]
                }
            }
            return mock_data
        else:
            print("[TEST_MODE] Simulando respuesta de API-Football...")
            mock_data = {
                "response": [
                    {
                        "fixture": {
                            "status": {"short": "FT"}
                        },
                        "teams": {
                            "home": {"name": "Austria"},
                            "away": {"name": "Jordan"}
                        },
                        "goals": {
                            "home": 1,
                            "away": 0
                        }
                    }
                ]
            }
            return mock_data

    # Configuración de URLs y Headers según el proveedor
    if api_type == "RAPID_API":
        url = f"https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026&date={date_str}"
        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
        }
    elif api_type == "LIVE_SCORE_API":
        api_secret = os.environ.get("API_SECRET", "")
        url = f"https://livescore-api.com/api-client/scores/history.json?key={api_key}&secret={api_secret}&date={date_str}&league=1"
        headers = {}
    else: # API_SPORTS (directa de API-Football)
        url = f"https://v3.football.api-sports.io/fixtures?league=1&season=2026&date={date_str}"
        headers = {
            "x-apisports-key": api_key
        }

    print(f"Consultando API externa ({api_type}): {url}")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error llamando a la API ({api_type}): {e}")
        return None

def main():
    partidos_path = 'partidos.json'
    if not os.path.exists(partidos_path):
        print(f"No se encontró {partidos_path}")
        return

    with open(partidos_path, 'r', encoding='utf-8') as f:
        partidos = json.load(f)

    # Identificar si hay algún partido en la ventana de polling (105 a 180 min de kickoff)
    now_utc = datetime.now(timezone.utc)
    matches_to_poll = []
    dates_to_query = set()

    for p in partidos:
        if p.get('resultado') is None and 'kickoff' in p:
            try:
                kickoff_time = parse_kickoff(p['kickoff'])
                kickoff_utc = kickoff_time.astimezone(timezone.utc)
                diff_minutes = (now_utc - kickoff_utc).total_seconds() / 60

                # Ventana de Polling: del minuto 105 al 180 (o posterior por retrasos)
                if diff_minutes >= 105:
                    print(f"Partido detectado en ventana de juego ({int(diff_minutes)} min desde inicio): {p['partido']}")
                    matches_to_poll.append(p)
                    dates_to_query.add(kickoff_time.strftime('%Y-%m-%d'))
            except Exception as ex:
                print(f"Error al analizar kickoff del partido {p['id']}: {ex}")

    if not matches_to_poll:
        print("No hay partidos en la ventana de juego (105-180 min). Finalizando sin hacer peticiones a la API (Cuota ahorrada).")
        return

    api_key = os.environ.get("API_KEY")
    api_type = os.environ.get("API_TYPE", "API_SPORTS")
    
    if not api_key and os.environ.get("TEST_MODE") != "true":
        print("Error: API_KEY no configurada. Configura el secreto en tu repositorio.")
        return

    # Consultamos la API externa
    api_fixtures = []
    for d_str in dates_to_query:
        api_response = fetch_live_scores(api_key, api_type, d_str)
        if api_response:
            if api_type == "LIVE_SCORE_API" and api_response.get("success"):
                matches = api_response.get("data", {}).get("match", [])
                api_fixtures.extend(matches)
            elif "response" in api_response:
                api_fixtures.extend(api_response["response"])

    # Crear mapa de búsqueda
    api_lookup = {}
    if api_type == "LIVE_SCORE_API":
        for m in api_fixtures:
            home = m.get("home_name", "").strip()
            away = m.get("away_name", "").strip()
            api_lookup[(home, away)] = m
    else:
        for f in api_fixtures:
            home = f.get("teams", {}).get("home", {}).get("name", "").strip()
            away = f.get("teams", {}).get("away", {}).get("name", "").strip()
            api_lookup[(home, away)] = f

    # Cruzar marcadores
    updated = False
    for p in matches_to_poll:
        if ' vs ' not in p['partido']:
            continue
        home, away = [t.strip() for t in p['partido'].split(' vs ')]
        
        api_match = api_lookup.get((home, away))
        if api_match:
            if api_type == "LIVE_SCORE_API":
                status = api_match.get("status")
                if status == "FINISHED":
                    score_str = api_match.get("score", "")
                    if " - " in score_str:
                        try:
                            local_goals, away_goals = [int(g.strip()) for g in score_str.split(" - ")]
                            p['resultado'] = {
                                "local": local_goals,
                                "visitante": away_goals
                            }
                            updated = True
                            print(f"Resultado FINALIZADO guardado (Live-Score-API) para {p['partido']}: {local_goals}-{away_goals}")
                        except Exception as e:
                            print(f"Error al parsear marcador '{score_str}': {e}")
                else:
                    print(f"Partido {p['partido']} sigue en juego (Live-Score-API Estado: {status}). Omitiendo guardado.")
            else:
                status_short = api_match.get("fixture", {}).get("status", {}).get("short")
                if status_short in ["FT", "AET", "PEN"]:
                    goals = api_match.get("goals", {})
                    local_goals = goals.get("home")
                    away_goals = goals.get("away")
                    
                    if local_goals is not None and away_goals is not None:
                        p['resultado'] = {
                            "local": local_goals,
                            "visitante": away_goals
                        }
                        updated = True
                        print(f"Resultado FINALIZADO guardado (API-Football) para {p['partido']}: {local_goals}-{away_goals}")
                else:
                    print(f"Partido {p['partido']} sigue en juego (API-Football Estado: {status_short}). Omitiendo guardado.")

    if updated:
        with open(partidos_path, 'w', encoding='utf-8') as f:
            json.dump(partidos, f, indent=2, ensure_ascii=False)
        print("Partidos actualizados y guardados en partidos.json.")
        
        # Bandera para el workflow de GitHub Actions
        with open('updated.txt', 'w') as f:
            f.write('true')
    else:
        print("No se encontraron resultados finales listos para guardar.")

if __name__ == "__main__":
    main()
