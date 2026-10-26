import { Test, TestingModule } from '@nestjs/testing';
import { KafkaToolkitService } from './kafka-toolkit.service';

describe('KafkaToolkitService', () => {
  let service: KafkaToolkitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaToolkitService],
    }).compile();

    service = module.get<KafkaToolkitService>(KafkaToolkitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
