const Fastify = require('fastify');
const fastify = Fastify();
fastify.get('/api/render', async (request, reply) => {
    return { ok: true };
});
fastify.inject({
    method: 'GET',
    url: '/api/render%3Fpath=/'
}).then(res => console.log("%3F:", res.json()));

fastify.inject({
    method: 'GET',
    url: '/api/render?path=/'
}).then(res => console.log("?:", res.json()));
