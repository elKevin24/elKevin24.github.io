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

# Configuración
WORLDCUP_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json"
TIMEZONE = "America/Guatemala"


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


def format_match_card(match_data, minute=None, status='live'):
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


def export_to_json(live_match, next_match, current_date, current_time):
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
        result["live"] = {
            "team1": match_data.get('team1', ''),
            "team2": match_data.get('team2', ''),
            "minute": minute if not isinstance(minute, str) else int(minute) if str(minute).isdigit() else None,
            "minute_display": f"{int(minute)}'" if isinstance(minute, (int, float)) else str(minute),
            "score1": match_data.get('score', {}).get('ft', [0, 0])[0] if isinstance(match_data.get('score', {}), dict) else 0,
            "score2": match_data.get('score', {}).get('ft', [0, 0])[1] if isinstance(match_data.get('score', {}), dict) else 0,
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

    print("\n" + "-" * 60)

    if live_match:
        match_data, minute = live_match
        print("\n✅ PARTIDO EN VIVO ENCONTRADO:\n")
        card = format_match_card(match_data, minute, status='live')
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
    json_data = export_to_json(live_match, next_match, current_date, current_time)
    
    try:
        with open('live_match.json', 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ Datos exportados a: live_match.json")
    except Exception as e:
        print(f"\n❌ Error al exportar JSON: {e}")


if __name__ == "__main__":
    main()
