from flask import Flask, Response
import requests
import time

app = Flask(__name__)
url = "https://dis-personals-terminals-memorial.trycloudflare.com/frame.jpg"

def generate_frames():
    while True:
        try:
            r = requests.get(url, timeout=5)
            r.raise_for_status()
            frame = r.content
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        except requests.RequestException:
            pass
        time.sleep(0.5)

@app.route("/frame")
def frame():
    return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
