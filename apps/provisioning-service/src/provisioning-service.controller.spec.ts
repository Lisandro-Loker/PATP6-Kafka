import { Test, TestingModule } from '@nestjs/testing';
import { ProvisioningServiceController } from './provisioning-service.controller';
import { ProvisioningServiceService } from './provisioning-service.service';

describe('ProvisioningServiceController', () => {
  let provisioningServiceController: ProvisioningServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ProvisioningServiceController],
      providers: [ProvisioningServiceService],
    }).compile();

    provisioningServiceController = app.get<ProvisioningServiceController>(ProvisioningServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(provisioningServiceController.getHello()).toBe('Hello World!');
    });
  });
});
