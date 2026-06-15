const regex = new RegExp(`<link[^>]*href="[^"]*index-[^"]+\\.css"[^>]*>`);
const html = '<head><link rel="stylesheet" crossorigin href="/assets/index-T62S63_C.css"></head>';
console.log(html.replace(regex, '<style>body{color:red}</style>'));
