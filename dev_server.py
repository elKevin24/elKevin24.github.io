import http.server
import json
import os
import sys

PORT = 8080

class DevServerHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Muestra logs limpios en la consola
        sys.stderr.write(f"[DevServer] {format % args}\n")

    def do_POST(self):
        if self.path == '/api/update-match':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                match_id = data.get('id')
                local_goals = data.get('local')
                away_goals = data.get('visitante')
                
                if match_id is None or local_goals is None or away_goals is None:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "Missing parameters"}')
                    return
                    
                # Leer partidos.json
                partidos_path = 'partidos.json'
                if not os.path.exists(partidos_path):
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "partidos.json not found"}')
                    return
                    
                with open(partidos_path, 'r', encoding='utf-8') as f:
                    partidos = json.load(f)
                    
                # Buscar y actualizar partido
                found = False
                for p in partidos:
                    if p.get('id') == match_id:
                        p['resultado'] = {
                            "local": int(local_goals),
                            "visitante": int(away_goals)
                        }
                        found = True
                        break
                        
                if not found:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"error": "Match not found"}')
                    return
                    
                # Guardar partidos.json
                with open(partidos_path, 'w', encoding='utf-8') as f:
                    json.dump(partidos, f, indent=2, ensure_ascii=False)
                    
                # Actualizar updated.txt
                with open('updated.txt', 'w', encoding='utf-8') as f:
                    f.write('true')
                    
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"success": true}')
                print(f"[DevServer] Partido ID {match_id} actualizado manual a {local_goals}-{away_goals} y guardado en partidos.json")
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    # Cambiar al directorio del script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, DevServerHandler)
    print("=" * 60)
    print(f"Servidor de desarrollo activo en http://localhost:{PORT}")
    print("Soporta persistencia automática de partidos.json mediante POST.")
    print("Presiona Ctrl+C para salir.")
    print("=" * 60)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[DevServer] Servidor detenido.")
        sys.exit(0)
