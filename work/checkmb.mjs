for(const u of ['https://xs.com.vn/xsmb-ngay-3-8-2026.html','https://xsmb.com.vn/']){const r=await fetch(u);const h=await r.text();console.log(u,r.status,h.length,h.match(/<title>(.*?)<\/title>/i)?.[1],h.includes('Giải 7'),h.indexOf('Giải 7'),h.indexOf('Đặc biệt'))}
const h=await(await fetch('https://xs.com.vn/xsmb-ngay-3-8-2026.html')).text();let i=h.indexOf('Giải 7');console.log(h.slice(i-300,i+1200));
for(const pat of ['ĐB','Đặc biệt','Giải đặc']){let j=h.indexOf(pat);console.log(pat,j,h.slice(j-200,j+500))}
console.log(h.slice(17500,18800));
