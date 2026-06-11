const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.ts')) {
      let c = fs.readFileSync(p, 'utf8');
      const o = c;
      c = c.replace(
        /'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType\)/g,
        "'ADMIN' as RoleType, 'HOTEL_STAFF' as RoleType, 'HOTEL_FD' as RoleType)"
      );
      if (c !== o) fs.writeFileSync(p, c);
    }
  }
}

walk(path.join(__dirname, '..', 'src', 'app', 'api'));
