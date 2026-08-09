import os
import sys
import requests
import cv2

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

def test_road_video_and_streaming(road_id, expected_road_name):
    base_url = "http://localhost:8000/api/v1"
    
    print("=" * 65)
    print(f" AUTOMATED VERIFICATION: {expected_road_name.upper()} (ROAD #{road_id})")
    print("=" * 65)

    # 1. Test Road Video Details Endpoint
    details_url = f"{base_url}/videos/road/{road_id}"
    print(f"\n[TEST 1] Querying road video details: {details_url}")
    res = requests.get(details_url)
    assert res.status_code == 200, f"Expected status 200, got {res.status_code}"
    data = res.json()
    print(f"  [OK] Road ID:       {data.get('road_id')}")
    print(f"  [OK] Road Name:     {data.get('road_name')}")
    print(f"  [OK] Video ID:      {data.get('video_id')}")
    print(f"  [OK] Has Video:     {data.get('has_video')}")
    print(f"  [OK] Stream URL:    {data.get('stream_url')}")
    print(f"  [OK] Status:        {data.get('status')}")

    video_id = data.get('video_id')
    assert video_id is not None, "Video ID must not be None"

    # 2. Test HTTP Range Request (206 Partial Content)
    stream_endpoint = f"{base_url}/videos/{video_id}/stream"
    headers = {"Range": "bytes=0-1023"}
    print(f"\n[TEST 2] Requesting HTTP Range stream (bytes=0-1023): {stream_endpoint}")
    stream_res = requests.get(stream_endpoint, headers=headers, stream=True)
    
    print(f"  [OK] HTTP Status:       {stream_res.status_code} (Expected: 206)")
    print(f"  [OK] Content-Type:      {stream_res.headers.get('Content-Type')}")
    print(f"  [OK] Content-Range:     {stream_res.headers.get('Content-Range')}")
    print(f"  [OK] Content-Length:    {stream_res.headers.get('Content-Length')}")
    print(f"  [OK] Accept-Ranges:     {stream_res.headers.get('Accept-Ranges')}")

    assert stream_res.status_code == 206, f"Expected 206 Partial Content, got {stream_res.status_code}"
    assert stream_res.headers.get("Content-Type") == "video/mp4", f"Expected video/mp4, got {stream_res.headers.get('Content-Type')}"
    assert "bytes 0-1023/" in stream_res.headers.get("Content-Range", ""), f"Unexpected Content-Range: {stream_res.headers.get('Content-Range')}"
    assert len(stream_res.content) == 1024, f"Expected 1024 bytes, got {len(stream_res.content)}"

    # 3. Test Full Stream Request (200 OK)
    print(f"\n[TEST 3] Requesting full stream (no Range header): {stream_endpoint}")
    full_res = requests.get(stream_endpoint, stream=True)
    print(f"  [OK] HTTP Status:       {full_res.status_code} (Expected: 200)")
    print(f"  [OK] Content-Type:      {full_res.headers.get('Content-Type')}")
    print(f"  [OK] Content-Length:    {full_res.headers.get('Content-Length')}")
    assert full_res.status_code == 200, f"Expected 200 OK, got {full_res.status_code}"

    # 4. Test Video Telemetry Timeline
    telemetry_url = f"{base_url}/videos/{video_id}/telemetry"
    print(f"\n[TEST 4] Querying video telemetry timeline: {telemetry_url}")
    t_res = requests.get(telemetry_url)
    assert t_res.status_code == 200, f"Expected 200, got {t_res.status_code}"
    t_data = t_res.json()
    telemetry = t_data.get("telemetry", [])
    print(f"  [OK] Total Telemetry Records: {len(telemetry)}")
    if telemetry:
        sample = telemetry[0]
        v_total = sample.get('vehicle_count')
        v_sum = sample.get('car_count', 0) + sample.get('bus_count', 0) + sample.get('truck_count', 0) + sample.get('motorcycle_count', 0)
        assert v_total == v_sum, f"Math mismatch: total {v_total} != sum {v_sum}"
        print(f"  [OK] First Record Timestamp:  {sample.get('video_timestamp')}s")
        print(f"  [OK] Vehicle Count Math:      {v_total} == {v_sum} ({sample.get('car_count')} Cars, {sample.get('bus_count')} Buses, {sample.get('truck_count')} Trucks, {sample.get('motorcycle_count')} Motos)")
        print(f"  [OK] Speed / Congestion:      {sample.get('average_speed')} km/h / {sample.get('congestion_level')}")
        print(f"  [OK] Confidence:              {round(sample.get('confidence', 0) * 100, 1)}%")

    # 5. Check Video Codec of Processed Video
    proc_video_path = os.path.join(backend_dir, "uploads", "processed", f"processed_{data.get('filename')}")
    if not os.path.exists(proc_video_path):
        proc_video_path = os.path.join(backend_dir, "uploads", "videos", data.get('filename'))
    
    print(f"\n[TEST 5] Checking video FourCC codec of: {proc_video_path}")
    cap = cv2.VideoCapture(proc_video_path)
    assert cap.isOpened(), "Could not open video file with OpenCV"
    fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC))
    fourcc_hex = hex(fourcc_int)
    cap.release()
    print(f"  [OK] FourCC Hex Code:   {fourcc_hex}")
    print(f"  [OK] Codec Identified:  {'h264' if fourcc_hex == '0x34363268' else 'mp4v' if fourcc_hex == '0x34504d46' else fourcc_hex}")

    print("\n" + "=" * 65)
    print(f" ALL CHECKS PASSED FOR {expected_road_name.upper()}!")
    print("=" * 65)

if __name__ == "__main__":
    test_road_video_and_streaming(1, "5th Avenue Corridor")
    print("\n\n")
    test_road_video_and_streaming(2, "Wall Street Junction")
    print("\n\n")
    test_road_video_and_streaming(4, "Fulton Transit Corridor")
