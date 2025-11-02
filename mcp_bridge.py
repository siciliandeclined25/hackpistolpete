import mcp_bridge
mcp_bridge.start_bridge()
mcp_bridge.run_event_loop()
def sendContextToMCP(endpoint, data):
    import requests
    url = f'http://localhost:5000/{endpoint}'
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()
        print(f"Context sent to MCP at {endpoint}: {data}")
    except requests.exceptions.RequestException as e:
        print(f"Error sending context to MCP: {e}")

def receiveResponseFromMCP(endpoint):
    import requests
    url = f'http://localhost:5000/{endpoint}'
    try:
        response = requests.get(url)
        response.raise_for_status()
        print(f"Response received from MCP at {endpoint}: {response.json()}")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error receiving response from MCP: {e}")
        return None
