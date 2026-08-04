import { Module } from '@nestjs/common';
import { LocalFileStorage } from '../../infrastructure/adapters/file-storage.adapter';
import { PdfRendererService } from '../printouts/pdf-renderer.service';
import { PrintoutService } from '../printouts/printout.service';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

@Module({
  controllers: [DocumentController],
  providers: [DocumentService, LocalFileStorage, PdfRendererService, PrintoutService],
  exports: [DocumentService, PrintoutService],
})
export class DocumentModule {}
