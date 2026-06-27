import urllib.request
import json
import sys

SERVER_URL = "https://nxlab.nett.to/api"

ASCII_ART = """
 _   _  __  __ _        _     ____  
| \\ | | \\ \\/ /| |      / \\   | __ ) 
|  \\| |  \\  / | |     / _ \\  |  _ \\ 
| |\\  |  /  \\ | |___ / ___ \\ | |_) |
|_| \\_| /_/\\_\\|_____/_/   \\_\\|____/ 
"""

COLOR_GREEN = "\033[92m"
COLOR_BLUE = "\033[96m"
COLOR_RED = "\033[91m"
COLOR_RESET = "\033[0m"

def execute_command(cmd, data):
    payload = json.dumps({"cmd": cmd, "data": data}).encode('utf-8')
    req = urllib.request.Request(
        SERVER_URL, 
        data=payload, 
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            # 伺服器成功 (200 OK) 時回傳的是「純文字」，直接解碼並印出即可
            res_text = response.read().decode('utf-8')
            print(res_text)
                
    except urllib.error.HTTPError as e:
        try:
            # 伺服器錯誤時 (如 404, 429) 回傳的是 JSON: {"error": "..."}
            err_res = json.loads(e.read().decode('utf-8'))
            print(f"{COLOR_RED}ERROR:{COLOR_RESET} {err_res.get('error')}")
        except Exception:
            print(f"{COLOR_RED}ERROR:{COLOR_RESET} Server returned status code {e.code}")
    except Exception as e:
        print(f"{COLOR_RED}ERROR:{COLOR_RESET} Connection failed ({e})")

def main():
    print(ASCII_ART)
    print(f"{COLOR_GREEN}SYSTEM // CONNECTION SECURE // READY FOR INPUT...{COLOR_RESET}")
    print("Type 'exit' or 'quit' to terminate session.\n")
    
    while True:
        try:
            user_input = input("> ").strip()
            if not user_input:
                continue
            
            if user_input.lower() in ["exit", "quit"]:
                print("Connection terminated.")
                break
            
            parts = user_input.split(" ", 1)
            cmd = parts[0]
            data = parts[1] if len(parts) > 1 else ""
            
            execute_command(cmd, data)
            print() 
            
        except KeyboardInterrupt:
            print("\nConnection terminated.")
            break
        except EOFError:
            break

if __name__ == "__main__":
    main()