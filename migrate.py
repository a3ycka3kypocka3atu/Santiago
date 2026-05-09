import os
import re

ma3_dir = "/Users/andrij/Desktop/Anti/MA3"
san_dir = "/Users/andrij/Desktop/Anti/Santiago"

# 1. Migrate style.css
with open(os.path.join(ma3_dir, 'style.css'), 'r') as f:
    ma3_css = f.read()

cal_css_match = re.search(r'(/\* ═══════════════════════════════════════════════════════════\n   CALENDAR PAGE.*?)(/\* ── Reduced Motion ── \*/)', ma3_css, re.DOTALL)
if cal_css_match:
    cal_css = cal_css_match.group(1)
    with open(os.path.join(san_dir, 'style.css'), 'a') as f:
        f.write("\n\n" + cal_css)
    print("CSS migrated.")

# 2. Migrate translations.js
with open(os.path.join(ma3_dir, 'translations.js'), 'r') as f:
    ma3_trans = f.read()

cal_trans_match = re.search(r'(  // ═══════════════════════════════════════════════════════════\n  //  CALENDAR PAGE.*?\n);', ma3_trans, re.DOTALL)
if cal_trans_match:
    cal_trans = cal_trans_match.group(1)
    
    # Read target translations
    with open(os.path.join(san_dir, 'translations.js'), 'r') as f:
        san_trans = f.read()
    
    # Replace the last `};\n` with the new translations
    san_trans = re.sub(r'\n};\n*$', "\n" + cal_trans + "\n};\n", san_trans)
    
    with open(os.path.join(san_dir, 'translations.js'), 'w') as f:
        f.write(san_trans)
    print("Translations migrated.")

# 3. Add Supabase script to index.html
with open(os.path.join(san_dir, 'index.html'), 'r') as f:
    index_html = f.read()

if '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>' not in index_html:
    index_html = index_html.replace('</body>', '  <!-- Supabase -->\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n</body>')
    with open(os.path.join(san_dir, 'index.html'), 'w') as f:
        f.write(index_html)
    print("Supabase CDN added to index.html")
