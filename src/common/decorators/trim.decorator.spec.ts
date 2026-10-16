import { plainToInstance } from 'class-transformer';
import { Trim } from './trim.decorator';

class TestDto {
  @Trim()
  name!: string;
}

describe('Trim', () => {
  it('trims leading and trailing whitespace', () => {
    const dto = plainToInstance(TestDto, { name: '  Name ' });
    expect(dto.name).toBe('Name');
  });

  it('leaves a non-string value untouched', () => {
    const dto = plainToInstance(TestDto, { name: 42 });
    expect(dto.name).toBe(42);
  });
});
