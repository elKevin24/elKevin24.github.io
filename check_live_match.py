#!/usr/bin/env python3
"""
Script para determinar qué partido de fútbol está en vivo
desde el calendario de la Copa del Mundo 2026.

Requisitos:
- Obtiene datos de: https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
- Zona horaria: America/Guatemala (CST/UTC-6)
- Busca partidos en vivo comparando fecha y hora actual
- Convierte correctamente husos horarios de los partidos
"""

import requests
import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import re
import os

# Configuración
WORLDCUP_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
TIMEZONE = "America/Guatemala"


def load_env():
    """Carga variables de entorno desde un archivo .env local si existe."""
    if os.path.exists('.env'):
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    parts = line.split('=', 1)
                    if len(parts) == 2:
                        k, v = parts[0].strip(), parts[1].strip().strip('"').strip("'")
                        os.environ[k] = v


# Cargar variables de entorno al iniciar
load_env()


def fetch_api_live_data(current_date):
    """
    Consulta las APIs externas (API-Sports, RapidAPI, LiveScore-API o la API abierta de worldcup26.ir)
    para cruzar datos en tiempo real de partidos en vivo.
    """
    api_key = os.environ.get("API_KEY")
    api_type = os.environ.get("API_TYPE", "WORLDCUP_IR")
    api_secret = os.environ.get("API_SECRET")

    # Simulación en Modo Prueba (TEST_MODE)
    if os.environ.get("TEST_MODE") == "true":
        print(f"[TEST_MODE] Simulando respuesta de API para tipo {api_type}...")
        if api_type == "LIVE_SCORE_API":
            return {
                "success": True,
                "data": {
                    "match": [
                        {
                            "home_name": "Uzbekistan",
                            "away_name": "Colombia",
                            "score": "1 - 2",
                            "status": "IN_PROGRESS",
                            "time": "8"
                        }
                    ]
                }
            }
        elif api_type == "WORLDCUP_IR":
            return {
                "games": [
                    {
                        "home_team_name_en": "Uzbekistan",
                        "away_team_name_en": "Colombia",
                        "home_score": "1",
                        "away_score": "2",
                        "time_elapsed": "live",
                        "finished": "FALSE"
                    }
                ]
            }
        else:  # API_SPORTS / RAPID_API
            return {
                "response": [
                    {
                        "fixture": {
                            "status": {
                                "short": "1H",
                                "elapsed": 8
                            }
                        },
                        "teams": {
                            "home": {"name": "Uzbekistan"},
                            "away": {"name": "Colombia"}
                        },
                        "goals": {
                            "home": 1,
                            "away": 2
                        }
                    }
                ]
            }

    # WORLDCUP_IR es pública y no requiere clave API
    if api_type == "WORLDCUP_IR":
        url = "https://worldcup26.ir/get/games"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    else:
        if not api_key:
            return None

        # Configuración de URLs y Headers
        if api_type == "RAPID_API":
            url = f"https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026&date={current_date}"
            headers = {
                "x-rapidapi-key": api_key,
                "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
            }
        elif api_type == "LIVE_SCORE_API":
            url = f"https://livescore-api.com/api-client/scores/live.json?key={api_key}&secret={api_secret}&league=1"
            headers = {}
        else:  # API_SPORTS
            url = f"https://v3.football.api-sports.io/fixtures?league=1&season=2026&date={current_date}"
            headers = {
                "x-apisports-key": api_key
            }

    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()

        # Verificar si hay errores de plan en la respuesta
        if isinstance(data, dict) and data.get("errors"):
            print(f"⚠️ API retornó errores: {data['errors']}")
            return None
        return data
    except Exception as e:
        print(f"⚠️ Error al conectar con la API de marcadores en vivo ({api_type}): {e}")
        return None


def find_live_match_in_api(api_data, api_type, home_team, away_team):
    """
    Busca un partido específico en los datos retornados por la API y extrae marcador/minuto.
    """
    if not api_data:
        return None

    if api_type == "WORLDCUP_IR":
        games = api_data.get("games", [])
        for g in games:
            h = g.get("home_team_name_en", "").strip().lower()
            a = g.get("away_team_name_en", "").strip().lower()
            target_h = home_team.strip().lower()
            target_a = away_team.strip().lower()
            
            # Normalizaciones
            if "congo" in h and "congo" in target_h: h = target_h
            if "congo" in a and "congo" in target_a: a = target_a

            if (h == target_h and a == target_a) or (h == target_a and a == target_h):
                try:
                    score1 = int(g.get("home_score", 0))
                    score2 = int(g.get("away_score", 0))
                except (ValueError, TypeError):
                    score1, score2 = 0, 0
                
                if h == target_a:
                    score1, score2 = score2, score1
                    
                time_el = g.get("time_elapsed", "").lower()
                finished = g.get("finished", "").upper() == "TRUE"
                
                status_display = "Finalizado" if finished else "live" if time_el == "live" else time_el
                return {
                    "score1": score1,
                    "score2": score2,
                    "minute": None,
                    "minute_display": status_display
                }

    elif api_type == "LIVE_SCORE_API":
        matches = api_data.get("data", {}).get("match", [])
        for m in matches:
            h = m.get("home_name", "").strip().lower()
            a = m.get("away_name", "").strip().lower()
            target_h = home_team.strip().lower()
            target_a = away_team.strip().lower()
            
            if (h == target_h and a == target_a) or (h == target_a and a == target_h):
                # Encontrado!
                score_str = m.get("score", "")
                score1, score2 = 0, 0
                if " - " in score_str:
                    try:
                        score1, score2 = map(int, score_str.split(" - "))
                    except ValueError:
                        pass
                
                # Minuto
                status = m.get("status", "")
                try:
                    minute = int(m.get("time", 0)) if str(m.get("time")).isdigit() else None
                except ValueError:
                    minute = None

                return {
                    "score1": score1,
                    "score2": score2,
                    "minute": minute,
                    "minute_display": f"{minute}'" if minute else status
                }
    else: # API-Football / RapidAPI
        fixtures = api_data.get("response", [])
        for f in fixtures:
            home = f.get("teams", {}).get("home", {}).get("name", "").strip().lower()
            away = f.get("teams", {}).get("away", {}).get("name", "").strip().lower()
            target_h = home_team.strip().lower()
            target_a = away_team.strip().lower()

            if (home == target_h and away == target_a) or (home == target_a and away == target_h):
                # Encontrado!
                goals = f.get("goals", {})
                score1 = goals.get("home", 0)
                score2 = goals.get("away", 0)
                
                # Minuto y estado
                status_info = f.get("fixture", {}).get("status", {})
                status_short = status_info.get("short")
                elapsed = status_info.get("elapsed")
                
                return {
                    "score1": score1 if score1 is not None else 0,
                    "score2": score2 if score2 is not None else 0,
                    "minute": elapsed,
                    "minute_display": f"{elapsed}'" if elapsed else status_short
                }
    return None


def fetch_worldcup_data():
    """Obtiene los datos de la Copa del Mundo desde GitHub."""
    try:
        response = requests.get(WORLDCUP_URL, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"❌ Error al obtener datos: {e}")
        return None


def get_current_time_guatemala():
    """Obtiene la fecha y hora actual en zona horaria de Guatemala."""
    tz = ZoneInfo(TIMEZONE)
    now = datetime.now(tz)
    current_date = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")
    return current_date, current_time, now


def extract_utc_offset(time_str):
    """
    Extrae el offset UTC de formato 'HH:MM UTC±X' o 'HH:MM UTC-X:Y'
    Ej: '12:00 UTC-5' -> -5, '15:30 UTC+2' -> 2
    """
    if not time_str:
        return None
    
    # Buscar patrón UTC±X o UTC±X:Y
    match = re.search(r'UTC([+-])(\d+):?(\d*)', time_str)
    if match:
        sign = -1 if match.group(1) == '-' else 1
        hours = int(match.group(2))
        minutes = int(match.group(3)) if match.group(3) else 0
        return sign * (hours * 60 + minutes)  # Retornar en minutos
    return None


def time_to_minutes(time_str):
    """Convierte formato HH:MM a minutos del día."""
    if not time_str:
        return None
    try:
        hours, minutes = map(int, time_str.split(':'))
        return hours * 60 + minutes
    except (ValueError, AttributeError):
        return None


def convert_match_time_to_guatemala(time_str):
    """
    Convierte hora del partido (con su huso horario) a Guatemala.
    Ej: '12:00 UTC-5' -> 11:00 (una hora antes en Guatemala UTC-6)
    """
    if not time_str:
        return None
    
    # Extraer solo la hora
    time_parts = time_str.split()
    match_time = time_parts[0]
    
    # Extraer offset UTC
    utc_offset = extract_utc_offset(time_str)
    
    if utc_offset is None:
        # Si no hay offset, asumir que está en UTC-6 (Guatemala)
        return match_time
    
    # Guatemala está en UTC-6 (-360 minutos)
    guatemala_offset = -360
    
    # Convertir hora del partido a minutos
    match_minutes = time_to_minutes(match_time)
    if match_minutes is None:
        return None
    
    # Diferencia de husos horarios en minutos
    offset_diff = utc_offset - guatemala_offset
    
    # Convertir a hora de Guatemala
    guatemala_minutes = match_minutes - offset_diff
    
    # Manejar el wrap-around (si es negativo o >= 1440)
    if guatemala_minutes < 0:
        guatemala_minutes += 1440
    elif guatemala_minutes >= 1440:
        guatemala_minutes -= 1440
    
    # Convertir de vuelta a HH:MM
    hours = int(guatemala_minutes // 60)
    minutes = int(guatemala_minutes % 60)
    
    return f"{hours:02d}:{minutes:02d}"


def calculate_match_status(match_start_minutes, current_minutes):
    """
    Calcula el estado del partido y minuto estimado.
    
    Retorna:
    - 'live': Si está en vivo (0-120 minutos)
    - 'upcoming': Si es próximo (< 0)
    - None: Si ya pasó (> 120 minutos)
    - minute: Minuto estimado del partido
    """
    if match_start_minutes is None or current_minutes is None:
        return None, None

    diff = current_minutes - match_start_minutes

    if diff < 0:
        return 'upcoming', None

    if 0 <= diff <= 120:
        # Calcular minuto estimado según reglas
        if diff <= 45:
            minute = diff
        elif diff <= 60:
            minute = "Descanso"
        else:
            minute = diff - 15  # Restar 15 para simular segundo tiempo

        return 'live', minute

    return None, None


def find_live_match(data, current_date, current_time):
    """
    Busca el partido en vivo o próximo en la fecha actual.
    """
    current_minutes = time_to_minutes(current_time)

    live_match = None
    next_match = None

    if 'matches' not in data:
        print("❌ Formato de datos inválido: no se encontró 'matches'")
        return None, None

    for match in data['matches']:
        match_date = match.get('date', '')

        # Solo procesar partidos de la fecha actual
        if match_date != current_date:
            continue

        match_time_raw = match.get('time', '')
        # Convertir a zona horaria de Guatemala
        match_time = convert_match_time_to_guatemala(match_time_raw)
        match_start_minutes = time_to_minutes(match_time)

        status, minute = calculate_match_status(match_start_minutes, current_minutes)

        if status == 'live':
            live_match = (match, minute)
            break

        elif status == 'upcoming' and next_match is None:
            next_match = match

    return live_match, next_match


def format_match_card(match_data, minute=None, status='live', api_live_info=None):
    """
    Formatea la información del partido en una Card de texto.
    """
    team1_name = match_data.get('team1', 'Equipo 1')
    team2_name = match_data.get('team2', 'Equipo 2')
    
    score = match_data.get('score', {})
    score_ft = score.get('ft', [None, None]) if isinstance(score, dict) else [None, None]
    
    score1 = score_ft[0] if score_ft[0] is not None else 0
    score2 = score_ft[1] if score_ft[1] is not None else 0

    stadium = match_data.get('ground', 'Estadio desconocido')
    city = match_data.get('city', '')

    card = ""

    if status == 'live':
        minute_display = f"{int(minute)}'" if isinstance(minute, (int, float)) else str(minute)
        
        if api_live_info:
            score1 = api_live_info.get("score1", score1)
            score2 = api_live_info.get("score2", score2)
            minute_display = api_live_info.get("minute_display", minute_display)
            card += f"🔴 EN VIVO | Minuto real (API): {minute_display}\n"
        else:
            card += f"🔴 EN VIVO | Minuto estimado: {minute_display}\n"
            
        card += f"{team1_name} {score1} - {score2} {team2_name}\n"
        card += f"🏟️  {stadium}"
        if city:
            card += f", {city}"
        card += "\n"

    else:  # upcoming
        card += f"⏰ PRÓXIMO PARTIDO\n"
        card += f"{team1_name} vs {team2_name}\n"
        card += f"Hora: {match_data.get('time', 'TBD')}\n"
        card += f"🏟️  {stadium}"
        if city:
            card += f", {city}"
        card += "\n"

    return card


def export_to_json(live_match, next_match, current_date, current_time, api_live_info=None):
    """Exporta información a JSON para consumir desde JavaScript."""
    result = {
        "timestamp": datetime.now(ZoneInfo(TIMEZONE)).isoformat(),
        "current_date": current_date,
        "current_time": current_time,
        "timezone": TIMEZONE,
        "live": None,
        "next": None,
        "has_live": False
    }

    if live_match:
        match_data, minute = live_match
        
        # Default calendar estimates
        score1 = match_data.get('score', {}).get('ft', [0, 0])[0] if isinstance(match_data.get('score', {}), dict) else 0
        score2 = match_data.get('score', {}).get('ft', [0, 0])[1] if isinstance(match_data.get('score', {}), dict) else 0
        minute_val = minute if not isinstance(minute, str) else int(minute) if str(minute).isdigit() else None
        minute_display = f"{int(minute)}'" if isinstance(minute, (int, float)) else str(minute)
        
        # Override with live API data if available
        if api_live_info:
            score1 = api_live_info.get("score1", score1)
            score2 = api_live_info.get("score2", score2)
            if api_live_info.get("minute") is not None:
                minute_val = api_live_info.get("minute")
            
            # Si el estado es 'live', mantenemos la estimación de minutos de calendario
            # pero con el marcador real de la API.
            if api_live_info.get("minute_display") == "live":
                pass
            else:
                minute_display = api_live_info.get("minute_display")
            
        result["live"] = {
            "team1": match_data.get('team1', ''),
            "team2": match_data.get('team2', ''),
            "minute": minute_val,
            "minute_display": minute_display,
            "score1": score1,
            "score2": score2,
            "stadium": match_data.get('ground', ''),
            "date": match_data.get('date', ''),
            "time": match_data.get('time', ''),
            "round": match_data.get('round', '')
        }
        result["has_live"] = True

    if next_match:
        result["next"] = {
            "team1": next_match.get('team1', ''),
            "team2": next_match.get('team2', ''),
            "stadium": next_match.get('ground', ''),
            "date": next_match.get('date', ''),
            "time": next_match.get('time', ''),
            "round": next_match.get('round', '')
        }

    return result


def main():
    """Función principal."""
    print("=" * 60)
    print("BUSCADOR DE PARTIDOS EN VIVO - COPA MUNDIAL 2026")
    print("=" * 60)

    # Obtener datos
    data = fetch_worldcup_data()
    if not data:
        return

    # Obtener hora actual en Guatemala
    current_date, current_time, now = get_current_time_guatemala()

    print(f"\n📅 Fecha actual: {current_date}")
    print(f"🕐 Hora actual (Guatemala): {current_time}")
    print(f"🌍 Zona horaria: {TIMEZONE}")

    # Buscar partido en vivo o próximo
    live_match, next_match = find_live_match(data, current_date, current_time)

    api_live_info = None
    if live_match:
        match_data, minute = live_match
        home_team = match_data.get('team1')
        away_team = match_data.get('team2')
        api_type = os.environ.get("API_TYPE", "WORLDCUP_IR")
        
        print(f"Buscando marcador en vivo para {home_team} vs {away_team} vía API ({api_type})...")
        api_data = fetch_api_live_data(current_date)
        if api_data:
            api_live_info = find_live_match_in_api(api_data, api_type, home_team, away_team)
            if api_live_info:
                min_disp = f"{minute}'" if api_live_info['minute_display'] == 'live' else api_live_info['minute_display']
                print(f"⚽ Datos en vivo encontrados desde API: Marcador {api_live_info['score1']} - {api_live_info['score2']}, Minuto: {min_disp}")
            else:
                print("⚠️ No se encontró coincidencia para el partido actual en la respuesta de la API.")
        else:
            print("⚠️ No se pudieron obtener datos en vivo de la API (usando estimación de calendario/OpenFootball).")

    print("\n" + "-" * 60)

    if live_match:
        match_data, minute = live_match
        print("\n✅ PARTIDO EN VIVO ENCONTRADO:\n")
        card = format_match_card(match_data, minute, status='live', api_live_info=api_live_info)
        print(card)

    elif next_match:
        print("\n⏳ NO HAY PARTIDO EN VIVO")
        print("📋 PRÓXIMO PARTIDO DE HOY:\n")
        card = format_match_card(next_match, status='upcoming')
        print(card)

    else:
        print("\n❌ NO HAY PARTIDOS HOY")

    print("-" * 60)

    # Exportar a JSON para consumir desde HTML/JavaScript
    json_data = export_to_json(live_match, next_match, current_date, current_time, api_live_info=api_live_info)
    
    try:
        with open('live_match.json', 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Datos exportados a: live_match.json")
    except Exception as e:
        print(f"\n❌ Error al exportar JSON: {e}")


if __name__ == "__main__":
    main()
