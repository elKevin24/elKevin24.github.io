#!/usr/bin/env python3
import json
import time
import random
import sys
from datetime import datetime, timezone

TEAMS = [
    "Mexico", "South Africa", "South Korea", "Canada", "Czech Republic",
    "Bosnia & Herzegovina", "Switzerland", "Qatar", "Brazil", "Morocco",
    "Haiti", "Scotland", "USA", "Paraguay", "Australia", "Turkey", "Germany",
    "Curaçao", "Ivory Coast", "Ecuador", "Netherlands", "Japan", "Sweden",
    "Tunisia", "Belgium", "Egypt", "Iran", "New Zealand", "Spain",
    "Cape Verde", "Saudi Arabia", "Uruguay", "France", "Senegal", "Norway",
    "Iraq", "Argentina", "Algeria", "Austria", "Jordan", "Portugal",
    "DR Congo", "Uzbekistan", "Colombia", "England", "Croatia", "Ghana", "Panama"
]

def print_banner():
    print("=" * 60)
    print("⚽ SIMULADOR DE PARTIDO EN VIVO - COPA MUNDIAL 2026 ⚽")
    print("=" * 60)

def main():
    print_banner()
    
    # Choose teams
    print("Equipos disponibles:")
    cols = 4
    for i in range(0, len(TEAMS), cols):
        row = TEAMS[i:i+cols]
        print("  " + "".join(f"{t:<18}" for t in row))
    print("-" * 60)

    # Let user input or pick randomly
    try:
        home = input("Elige equipo LOCAL (Enter para 'Mexico'): ").strip()
        if not home or home not in TEAMS:
            home = "Mexico"
            
        away = input("Elige equipo VISITANTE (Enter para 'Germany'): ").strip()
        if not away or away not in TEAMS:
            away = "Germany"
            
        if home == away:
            print("El equipo visitante no puede ser igual al local. Eligiendo 'Germany'.")
            away = "Germany"
    except (KeyboardInterrupt, SystemExit):
        print("\nCancelado.")
        return
    except Exception:
        home, away = "Mexico", "Germany"

    stadiums = [
        "Mexico City (Estadio Azteca)", 
        "Guadalajara (Estadio Akron)", 
        "Monterrey (Estadio BBVA)", 
        "Los Angeles (SoFi Stadium)", 
        "New York/New Jersey (MetLife Stadium)", 
        "Dallas (AT&T Stadium)"
    ]
    stadium = random.choice(stadiums)

    print(f"\n🚀 Iniciando simulación: {home} vs {away} en {stadium}!")
    print("Presiona Ctrl+C en cualquier momento para detener la simulación.\n")

    score_home = 0
    score_away = 0
    delay = 1.0  # segundos por minuto de juego

    def write_json(minute, is_break=False, finished=False):
        now = datetime.now(timezone.utc)
        
        if finished:
            status_display = "Finalizado"
            min_val = None
        elif is_break:
            status_display = "Descanso"
            min_val = "Descanso"
        else:
            status_display = f"{minute}'"
            min_val = minute

        live_data = {
            "timestamp": now.isoformat(),
            "current_date": now.strftime("%Y-%m-%d"),
            "current_time": now.strftime("%H:%M"),
            "timezone": "America/Guatemala",
            "live": {
                "team1": home,
                "team2": away,
                "minute": min_val,
                "minute_display": status_display,
                "score1": score_home,
                "score2": score_away,
                "stadium": stadium,
                "date": now.strftime("%Y-%m-%d"),
                "time": f"{now.strftime('%H:%M')} UTC",
                "round": "Fase de Grupos (Simulación)"
            },
            "next": None,
            "has_live": True
        }
        
        with open("live_match.json", "w", encoding="utf-8") as f:
            json.dump(live_data, f, indent=2, ensure_ascii=False)

    # First half
    for minute in range(1, 46):
        # Goal chances
        goal_scored = False
        if random.random() < 0.025:
            score_home += 1
            goal_scored = True
            print(f"\n⚽ ¡GOL de {home}! ({minute}') - Marcador: {home} {score_home} - {score_away} {away}")
        if random.random() < 0.02:
            score_away += 1
            goal_scored = True
            print(f"\n⚽ ¡GOL de {away}! ({minute}') - Marcador: {home} {score_home} - {score_away} {away}")
            
        if not goal_scored:
            sys.stdout.write(f"\r⏱️  Minuto {minute}' - {home} {score_home} - {score_away} {away}   ")
            sys.stdout.flush()
            
        write_json(minute)
        time.sleep(delay)

    # Halftime
    print(f"\n⏸️  Descanso - {home} {score_home} - {score_away} {away}")
    for i in range(4):
        sys.stdout.write(f"\rDescanso ({4-i}s restantes)...   ")
        sys.stdout.flush()
        write_json(45, is_break=True)
        time.sleep(1.0)
    print("\n▶️  Inicia el segundo tiempo!")

    # Second half
    for minute in range(46, 91):
        goal_scored = False
        if random.random() < 0.03:  # slightly higher action in 2nd half
            score_home += 1
            goal_scored = True
            print(f"\n⚽ ¡GOL de {home}! ({minute}') - Marcador: {home} {score_home} - {score_away} {away}")
        if random.random() < 0.025:
            score_away += 1
            goal_scored = True
            print(f"\n⚽ ¡GOL de {away}! ({minute}') - Marcador: {home} {score_home} - {score_away} {away}")
            
        if not goal_scored:
            sys.stdout.write(f"\r⏱️  Minuto {minute}' - {home} {score_home} - {score_away} {away}   ")
            sys.stdout.flush()
            
        write_json(minute)
        time.sleep(delay)

    print(f"\n🏁 ¡Final del partido! Resultado final: {home} {score_home} - {score_away} {away}\n")
    
    # Write final state (could clear or keep as finished)
    write_json(90, finished=True)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️ Simulación interrumpida por el usuario.")
