import request from 'supertest';
import express from 'express';
import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock'; // Import esmock

describe('Simple Test Example', () => {
    it('should pass this basic test', () => {
        expect(1 + 1).toBe(2); // Use Jest's expect
    });
});

// describe('ai-router.js with esmock', () => { // Updated describe block name to indicate esmock
//     let app;
//
//     beforeEach(() => {
//         app = express();
//         app.use(express.json());
//     });
//
//     describe('/process route', () => {
//         it('should return 200 and article data on successful process', async () => {
//             const processStub = sinon.stub().resolves({ // Create a Sinon stub directly (no need to reference processFunctions yet)
//                 article: 'test article',
//                 updatedArticleCount: 10,
//                 title: 'Test Title',
//                 id: 123
//             });
//
//             const aiRouter = await esmock('../routes/aiRoutes.ts', {
//                 '../routes/process.ts': {
//                     processArticle: processStub // Correct method name - match aiRoutes.ts
//                 }
//             });
//
//             app.use('/', aiRouter.default); // Mount the router (assuming aiRouter.mjs has a default export)
//
//             const response = await request(app)
//                 .post('/process')
//                 .send({});
//
//             expect(response.status).to.equal(200);
//             expect(response.body).to.deep.equal({
//                 article: 'test article',
//                 updatedArticleCount: 10,
//                 title: 'Test Title',
//                 id: 123
//             });
//             expect(processStub.calledOnce).to.be.true; // Assert that your stub was called
//             processStub.restore(); // Restore the stub (although esmock might handle this)
//         });
//
//         it('should return 500 and error message if process function throws error', async () => {
//             const processStub = sinon.stub().rejects(new Error('Processing error'));
//
//             const aiRouter = await esmock('../routes/aiRoutes.ts', {
//                 '../routes/process.ts': {
//                     processArticle: processStub
//                 }
//             });
//             app.use('/', aiRouter.default);
//
//             const response = await request(app)
//                 .post('/process')
//                 .send({});
//
//             expect(response.status).to.equal(500);
//             expect(response.text).to.include('Error generating article: Error: Processing error');
//             expect(processStub.calledOnce).to.be.true;
//             processStub.restore();
//         });
//     });
//
//     describe('/processFreeTrial route', () => {
//         it('should return 200 and article data on successful processFreeTrial', async () => {
//             const processFreeTrialStub = sinon.stub().resolves({
//                 article: 'free trial article',
//                 title: 'Free Trial Title',
//                 id: 456
//             });
//
//             const aiRouter = await esmock('../routes/aiRoutes.ts', {
//                 '../routes/process.ts': { // Still mock './process.ts' even for processFreeTrial route
//                     processFreeTrial: processFreeTrialStub // Mock processFreeTrial export
//                 }
//             });
//             app.use('/', aiRouter.default);
//
//             const response = await request(app)
//                 .post('/processFreeTrial')
//                 .set('X-Forwarded-For', '192.168.1.100')
//                 .send({});
//
//             expect(response.status).to.equal(200);
//             expect(response.body).to.deep.equal({
//                 article: 'free trial article',
//                 title: 'Free Trial Title',
//                 id: 456
//             });
//             expect(processFreeTrialStub.calledOnce).to.be.true;
//             processFreeTrialStub.restore();
//         });
//
//         it('should return 500 and error message if processFreeTrial function throws error', async () => {
//             const processFreeTrialStub = sinon.stub().rejects(new Error('Free trial error'));
//
//             const aiRouter = await esmock('../routes/aiRoutes.ts', {
//                 '../routes/process.ts': {
//                     processFreeTrial: processFreeTrialStub
//                 }
//             });
//             app.use('/', aiRouter.default);
//
//             const response = await request(app)
//                 .post('/processFreeTrial')
//                 .set('X-Forwarded-For', '192.168.1.100')
//                 .send({});
//
//             expect(response.status).to.equal(500);
//             expect(response.text).to.include('Error generating article: Error: Free trial error');
//             expect(processFreeTrialStub.calledOnce).to.be.true;
//             processFreeTrialStub.restore();
//         });
//     });
// });