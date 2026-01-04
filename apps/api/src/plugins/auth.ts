import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
      // request.user is automatically set by @fastify/jwt after jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}

export default fp(authPlugin);
