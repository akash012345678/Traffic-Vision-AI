import os
import subprocess
import imageio_ffmpeg

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
in_file = os.path.join(backend_dir, "uploads", "videos", "Wall Street Junction.mp4")
out_file = os.path.join(backend_dir, "uploads", "processed", "processed_Wall Street Junction.mp4")

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
cmd = [ffmpeg_exe, "-y", "-i", in_file, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", out_file]
print("Running fast ffmpeg re-encode:", cmd)
res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print("FFmpeg exit code:", res.returncode)
