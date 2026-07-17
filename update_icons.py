import os
import glob
import re

html_files = glob.glob('**/*.html', recursive=True)

old_icon = '<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></span>'
new_icon = '<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>'

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update icon
    content = content.replace(old_icon, new_icon)
    
    # Update nav-title to be gold
    content = content.replace('<span class="nav-title">5 ★</span>', '<span class="nav-title" style="color: #FFD700;">5 ★</span>')
    
    # Update mobile menu to be gold
    content = re.sub(r'(<span class="no">06</span>)5 ★(</a>)', r'\1<span style="color: #FFD700;">5 ★</span>\2', content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Icons updated")
