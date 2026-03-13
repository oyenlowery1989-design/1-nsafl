import requests
import time
from datetime import datetime

ROUTER = "http://192.168.8.1"
DISCONNECT_SECONDS = 45
RECONNECT_STABILIZE_SECONDS = 30
RETRY_PAUSE_SECONDS = 20
ROTATE_EVERY_SECONDS = 3600
MAX_RETRIES = 3

def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_public_ip():
    services = [
        "https://api.ipify.org",
        "https://ifconfig.me/ip",
        "https://icanhazip.com",
    ]
    for url in services:
        try:
            r = requests.get(url, timeout=15)
            ip = r.text.strip()
            if ip:
                return ip
        except requests.RequestException:
            pass
    return None

def set_mobile_data(state: int):
    url = f"{ROUTER}/api/dialup/mobile-dataswitch?dataswitch={state}"
    r = requests.get(url, timeout=15)
    r.raise_for_status()

def wait_with_countdown(seconds, message):
    for remaining in range(seconds, 0, -1):
        print(f"[{now()}] {message}: {remaining}s remaining", end="\r")
        time.sleep(1)
    print(" " * 100, end="\r")

def do_one_attempt():
    print(f"[{now()}] Disconnecting LTE...")
    set_mobile_data(0)
    wait_with_countdown(DISCONNECT_SECONDS, "LTE disconnected")

    print(f"[{now()}] Reconnecting LTE...")
    set_mobile_data(1)
    wait_with_countdown(RECONNECT_STABILIZE_SECONDS, "Waiting for internet to stabilize")

def rotate_until_changed():
    old_ip = get_public_ip()
    print(f"[{now()}] Current public IP: {old_ip or 'Could not detect'}")

    for attempt in range(1, MAX_RETRIES + 1):
        print(f"[{now()}] Rotation attempt {attempt}/{MAX_RETRIES}")
        do_one_attempt()

        new_ip = get_public_ip()
        print(f"[{now()}] IP after reconnect: {new_ip or 'Could not detect'}")

        if old_ip and new_ip and new_ip != old_ip:
            print(f"[{now()}] IP changed successfully.")
            return True

        print(f"[{now()}] Same IP returned or could not confirm change.")

        if attempt < MAX_RETRIES:
            print(f"[{now()}] Waiting {RETRY_PAUSE_SECONDS} seconds before retry...\n")
            time.sleep(RETRY_PAUSE_SECONDS)

    print(f"[{now()}] No IP change after all retries.")
    return False

def main():
    print(f"[{now()}] Script started. Rotation interval: 1 hour.")
    print(f"[{now()}] Press Ctrl+C to stop.\n")

    try:
        while True:
            rotate_until_changed()
            print(f"\n[{now()}] Waiting 1 hour until next rotation.\n")
            wait_with_countdown(ROTATE_EVERY_SECONDS, "Next rotation in")
    except KeyboardInterrupt:
        print(f"\n[{now()}] Stopped by user.")

if __name__ == "__main__":
    main()