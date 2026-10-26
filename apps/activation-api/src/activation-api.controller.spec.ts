import { Test, TestingModule } from '@nestjs/testing';
import { ActivationApiController } from './activation-api.controller';
import { ActivationApiService } from './activation-api.service';

describe('ActivationApiController', () => {
  let activationApiController: ActivationApiController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ActivationApiController],
      providers: [ActivationApiService],
    }).compile();

    activationApiController = app.get<ActivationApiController>(ActivationApiController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(activationApiController.getHello()).toBe('Hello World!');
    });
  });
});
