# 🏆 Buscador de Partidos en Vivo - Copa Mundial 2026

Script Python que determina qué partido de fútbol está siendo transmitido en vivo procesando el calendario de la Copa del Mundo 2026 desde una fuente JSON estática.

## 🎯 Características

✅ **Obtención de datos**: Realiza peticiones GET a `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`

✅ **Zona horaria correcta**: Utiliza `America/Guatemala` (CST/UTC-6) de forma obligatoria

✅ **Búsqueda inteligente**: Itera sobre los partidos buscando coincidencias con la fecha actual

✅ **Motor de tiempo**: Convierte horarios a minutos absolutos del día para calcular diferencias

✅ **Estados del partido**:
- **EN VIVO** (0-120 minutos desde inicio)
  - 0-45 min: Muestra el minuto exacto
  - 46-60 min: Muestra "Descanso"
  - 61+ min: Resta 15 minutos (simula segundo tiempo)
- **PRÓXIMO**: Cuando falta tiempo para que inicie
- **TERMINADO**: Cuando pasó más de 120 minutos

## 📋 Requisitos

```bash
pip install requests
```

## 🚀 Uso

```bash
python3 check_live_match.py
```

### Salida esperada - Partido EN VIVO:
```
🔴 EN VIVO | Minuto estimado: 25'
Portugal 1 - 0 DR Congo
🏟️  Houston
```

### Salida esperada - Próximo Partido:
```
⏰ PRÓXIMO PARTIDO
Uzbekistan vs Colombia
Hora: 20:00 UTC-6
🏟️  Mexico City
```

## 🔧 Detalles Técnicos

### Motor de conversión de tiempo

```python
# Conversión de HH:MM a minutos del día
Hora 13:00 → 13 × 60 + 0 = 780 minutos
Hora 14:30 → 14 × 60 + 30 = 870 minutos

# Diferencia = Minutos actuales - Minutos inicio
```

### Regla de minutos del partido

- **Primer Tiempo**: `Minuto = Diferencia` (si ≤ 45)
- **Descanso**: Mostrar "Descanso" (si 46-60)
- **Segundo Tiempo**: `Minuto = Diferencia - 15` (si > 60)

## 📁 Estructura de datos procesada

```json
{
  "date": "2026-06-17",
  "time": "20:00 UTC-6",
  "team1": "Uzbekistan",
  "team2": "Colombia",
  "ground": "Mexico City",
  "score": {
    "ft": [1, 0]
  }
}
```

## 🌐 Integración con GitHub Pages

Este script está optimizado para ejecutarse en repositorios de GitHub Pages y puede:

- Ser ejecutado como parte de un workflow de GitHub Actions
- Generar datos para actualizar una página web en tiempo real
- Consultarse desde JavaScript para actualizar elementos dinámicamente

## 📝 Notas

- La zona horaria se establece obligatoriamente en `America/Guatemala`
- El script busca el **primer** partido en vivo encontrado
- Si no hay partidos en vivo, muestra el próximo del día
- Maneja correctamente diferentes husos horarios en los datos (UTC-4, UTC-5, UTC-6)

## 🔄 Ejemplo de integración futura

```bash
# Ejecutar diariamente para actualizar estado
0 * * * * cd /path/to/repo && python3 check_live_match.py > current_match.txt
```

---

**Desarrollado para**: elKevin24.github.io  
**Fuente de datos**: [OpenFootball World Cup 2026](https://github.com/openfootball/worldcup.json)
