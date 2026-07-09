import sys, json, subprocess, re
from bs4 import BeautifulSoup

cmd = '''
tell application "Safari"
    set currentTab to front document
    set htmlContent to source of currentTab
    return htmlContent
end tell
'''
try:
    result = subprocess.run(['osascript', '-e', cmd], capture_output=True, text=True, check=True)
    html = result.stdout
    soup = BeautifulSoup(html, 'html.parser')
    
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if 'linkedin.com/in/' in href and '/jobs/' not in href and '/posts/' not in href:
            if href.startswith('/url?q='):
                href = href.split('/url?q=')[1].split('&')[0]
            links.add(href)
    
    if len(links) < 3:
        raw_links = re.findall(r'https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+', html)
        for raw_link in raw_links:
            links.add(raw_link)

    print(json.dumps(list(links)[:20]))
except Exception as e:
    print(json.dumps([]))
