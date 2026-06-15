const Fastify = require('fastify');
const fastify = Fastify();
fastify.inject({
    method: 'GET',
    url: '/api/render?path=/'
}).then(res => console.log("Unregistered route:", res.json()));
