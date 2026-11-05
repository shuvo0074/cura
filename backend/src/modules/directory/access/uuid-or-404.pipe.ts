import { Injectable, type PipeTransform } from '@nestjs/common';
import { directoryNotFound } from '../domain/errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed record id cannot match anything, so it is a 404 and not a 400. */
@Injectable()
export class UuidOr404 implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw directoryNotFound('Record');
    return value;
  }
}
