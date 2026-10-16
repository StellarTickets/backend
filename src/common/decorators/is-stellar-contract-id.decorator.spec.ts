import { validate } from 'class-validator';
import { IsStellarContractId } from './is-stellar-contract-id.decorator';

class TestDto {
  @IsStellarContractId()
  contractId!: string;
}

describe('IsStellarContractId', () => {
  it('accepts a valid contract id', async () => {
    const dto = new TestDto();
    dto.contractId = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a string that is not a valid contract id', async () => {
    const dto = new TestDto();
    dto.contractId = 'not-a-real-contract';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isStellarContractId');
  });

  it('rejects an account public key (G...) passed where a contract id belongs', async () => {
    const dto = new TestDto();
    dto.contractId = 'GBAHZWO3UI3GAHPQCPSW6IR5N7HJ4UBRZNAFMSYB6DAKVNHQDOZIV2YJ';

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
