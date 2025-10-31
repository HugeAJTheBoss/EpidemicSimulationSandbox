from flask import Flask, send_file, Response
import time, os

app = Flask(__name__)

@app.route('/live_frame')
def live_frame():
    def generate():
        while True:
            if os.path.exists("frame.jpg"):
                with open("frame.jpg", "rb") as f:
                    frame = f.read()
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            time.sleep(0.1)
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)