import json
import urllib.request
import urllib.parse
import time
import os

def fetch_team_metadata(team_name):
    """Busca los metadatos de un equipo en TheSportsDB."""
    api_key = os.environ.get("THESPORTSDB_KEY", "123")
    encoded_name = urllib.parse.quote(team_name)
    url = f"https://www.thesportsdb.com/api/v1/json/{api_key}/searchteams.php?t={encoded_name}"
    
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and data.get('teams'):
                # Buscamos el equipo que coincida mejor con el nombre
                for team in data['teams']:
                    if team['strTeam'].lower() == team_name.lower() or team_name.lower() in team['strTeam'].lower():
                        return {
                            "idTeam": team.get('idTeam'),
                            "name": team.get('strTeam'),
                            "badge": team.get('strBadge'),
                            "logo": team.get('strLogo'),
                            "stadium": team.get('strStadium'),
                            "stadium_thumb": team.get('strStadiumThumb'),
                            "banner": team.get('strBanner')
                        }
            elif api_key == "123" and team_name.lower() != "arsenal":
                print(f"ℹ️ Nota: La búsqueda de '{team_name}' no retornó resultados. La API Key gratuita de TheSportsDB (123) está limitada por el proveedor únicamente al equipo 'Arsenal'.")
    except Exception as e:
        print(f"Error buscando {team_name}: {e}")
    return None

def main():
    partidos_path = 'partidos.json'
    metadata_path = 'metadata_equipos.json'
    
    if not os.path.exists(partidos_path):
        print(f"Error: No se encontró {partidos_path}")
        return

    api_key = os.environ.get("THESPORTSDB_KEY", "123")
    if api_key == "123":
        print("ℹ️ Usando API Key gratuita (123) de TheSportsDB. Búsquedas nuevas estarán limitadas únicamente a 'Arsenal'.")
        print("💡 Para buscar otros equipos, configura la variable de entorno THESPORTSDB_KEY con tu clave premium.")
    else:
        print(f"🔑 Usando API Key personalizada de TheSportsDB: {api_key[:4]}***")

    with open(partidos_path, 'r', encoding='utf-8') as f:
        partidos = json.load(f)

    # Extraer nombres únicos de equipos
    equipos_unicos = set()
    for p in partidos:
        if ' vs ' in p['partido']:
            partes = p['partido'].split(' vs ')
            equipos_unicos.add(partes[0].strip())
            equipos_unicos.add(partes[1].strip())

    print(f"Se detectaron {len(equipos_unicos)} equipos únicos. Iniciando búsqueda de metadatos...")

    # Cargar metadatos existentes para evitar peticiones redundantes
    metadata = {}
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)

    nuevos_datos = 0
    for i, equipo in enumerate(sorted(equipos_unicos)):
        if equipo in metadata and metadata[equipo].get('badge'):
            continue
        
        print(f"[{i+1}/{len(equipos_unicos)}] Consultando: {equipo}...")
        data = fetch_team_metadata(equipo)
        
        if data:
            metadata[equipo] = data
            nuevos_datos += 1
        else:
            print(f"⚠️ No se encontraron datos para: {equipo}")
        
        # Respetar el Rate Limit (30 req/min teóricos, pero el servidor es estricto)
        # Usamos 3 segundos para ser conservadores y evitar el error 429
        time.sleep(3)

    if nuevos_datos > 0:
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        print(f"\n✅ Proceso completado. Se actualizaron {nuevos_datos} equipos.")
        print(f"Archivo guardado en: {metadata_path}")
    else:
        print("\nNo se encontraron nuevos metadatos para actualizar.")

if __name__ == "__main__":
    main()
