#!/usr/bin/env python3
"""
Sanitiza y valida quiniela.json antes del deploy.
- Escapa HTML en nombres de participantes
- Valida que IDs de predicción existan en partidos.json
- Valida que marcadores sean enteros >= 0
- Reporta predicciones faltantes por participante
"""

import json
import html
import sys
import os

# Fix Windows console encoding for emoji output
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def main():
    partidos_path = 'partidos.json'
    quiniela_path = 'quiniela.json'

    if not os.path.exists(partidos_path):
        print(f"❌ No se encontró {partidos_path}")
        sys.exit(1)
    if not os.path.exists(quiniela_path):
        print(f"❌ No se encontró {quiniela_path}")
        sys.exit(1)

    with open(partidos_path, 'r', encoding='utf-8') as f:
        partidos = json.load(f)
    with open(quiniela_path, 'r', encoding='utf-8') as f:
        quiniela = json.load(f)

    valid_ids = {p['id'] for p in partidos}
    total_partidos = len(partidos)
    modified = False
    errors = 0

    print("=" * 60)
    print("SANITIZACIÓN DE QUINIELA.JSON")
    print("=" * 60)
    print(f"Total partidos en partidos.json: {total_partidos}")
    print(f"IDs válidos: {min(valid_ids)}–{max(valid_ids)}")
    print()

    for p in quiniela.get('participantes', []):
        nombre_orig = p.get('nombre', '')
        nombre_safe = html.escape(nombre_orig)

        if nombre_orig != nombre_safe:
            print(f"⚠️  HTML escapado en nombre: '{nombre_orig}' → '{nombre_safe}'")
            p['nombre'] = nombre_safe
            modified = True

        preds = p.get('predicciones', [])
        pred_ids = set()
        invalid_preds = []

        for pred in preds:
            pid = pred.get('id')
            if pid not in valid_ids:
                print(f"  ❌ {nombre_safe}: predicción con ID inválido: {pid}")
                errors += 1
                invalid_preds.append(pred)
            else:
                pred_ids.add(pid)

            for campo in ('local', 'visitante'):
                val = pred.get(campo)
                if not isinstance(val, int) or val < 0:
                    print(f"  ❌ {nombre_safe}: marcador inválido en partido {pid}: {campo}={val}")
                    if isinstance(val, float) and val >= 0:
                        pred[campo] = int(val)
                        modified = True
                    else:
                        errors += 1

        # Reportar cobertura
        cobertura = len(pred_ids)
        faltantes = valid_ids - pred_ids
        if faltantes:
            faltantes_sorted = sorted(faltantes)
            print(f"📋 {nombre_safe}: {cobertura}/{total_partidos} predicciones "
                  f"({len(faltantes)} faltantes: IDs {faltantes_sorted[:10]}{'...' if len(faltantes_sorted) > 10 else ''})")
        else:
            print(f"✅ {nombre_safe}: {cobertura}/{total_partidos} predicciones (completo)")

    print()

    if modified:
        with open(quiniela_path, 'w', encoding='utf-8') as f:
            json.dump(quiniela, f, indent=2, ensure_ascii=False)
        print("✅ quiniela.json actualizado con datos sanitizados.")
    else:
        print("✅ No se requirieron cambios de sanitización.")

    if errors > 0:
        print(f"\n⚠️  Se encontraron {errors} errores de validación.")
        sys.exit(1)

    print("✅ Validación completada sin errores.")


if __name__ == '__main__':
    main()
