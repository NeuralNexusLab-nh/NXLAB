#!/bin/sh

SERVER_URL="https://nxlab.nett.to/api"

ASCII_ART='
 _   _  __  __ _        _     ____  
| \ | | \ \/ /| |      / \   | __ ) 
|  \| |  \  / | |     / _ \  |  _ \ 
| |\  |  /  \ | |___ / ___ \ | |_) |
|_| \_| /_/\_\|_____/_/   \_\|____/ 
'

COLOR_GREEN="\033[92m"
COLOR_BLUE="\033[96m"
COLOR_RED="\033[91m"
COLOR_RESET="\033[0m"

printf "%s\n" "$ASCII_ART"
printf "${COLOR_GREEN}SYSTEM // CONNECTION SECURE // READY FOR INPUT...${COLOR_RESET}\n"
printf "Type 'exit' or 'quit' to terminate session.\n\n"

while :; do
    printf "> "
    IFS= read -r user_input || break
    # Trim leading/trailing whitespace
    user_input=$(printf "%s" "$user_input" | awk '{$1=$1};1')
    [ -z "$user_input" ] && continue

    case "$(printf "%s" "$user_input" | tr '[:upper:]' '[:lower:]')" in
        exit|quit)
            printf "Connection terminated.\n"
            break
            ;;
    esac

    cmd=$(printf "%s" "$user_input" | cut -d' ' -f1)
    data=$(printf "%s" "$user_input" | cut -s -d' ' -f2-)

    # Escape double quotes in cmd and data
    esc_cmd=$(printf "%s" "$cmd" | sed 's/"/\\"/g')
    esc_data=$(printf "%s" "$data" | sed 's/"/\\"/g')
    json_payload="{\"cmd\":\"$esc_cmd\",\"data\":\"$esc_data\"}"

    response=$(curl -s -S -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$json_payload" "$SERVER_URL")
    http_code=$(printf "%s" "$response" | tail -n1)
    body=$(printf "%s" "$response" | head -n -1)

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        printf "%s\n" "$body"
    else
        err_msg=$(printf "%s" "$body" | awk -F'"' '/"error"/{print $(NF-1)}')
        if [ -n "$err_msg" ]; then
            printf "${COLOR_RED}ERROR:${COLOR_RESET} %s\n" "$err_msg"
        else
            printf "${COLOR_RED}ERROR:${COLOR_RESET} Server returned status code %s\n" "$http_code"
        fi
    fi
    printf "\n"
done