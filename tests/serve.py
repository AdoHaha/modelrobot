from http.server import SimpleHTTPRequestHandler, HTTPServer
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
import json

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/' or self.path.strip('/').isdigit():
            body = Environment(loader=FileSystemLoader('html')).get_template('index.html').render(linki=[], user=None).encode()
        elif self.path.startswith('/robots/'):
            body = json.dumps({'id':5629499534213120, 'urdf': Path('testowe/r2d2.xml').read_text()}).encode()
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json' if self.path.startswith('/robots/') else 'text/html')
        self.end_headers()
        self.wfile.write(body)

HTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
