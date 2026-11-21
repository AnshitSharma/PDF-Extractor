import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Report } from './entities/report.entity.js';
import { readPdfPages, type TextItem } from './pdf/pdf-reader.js';
import { parseReport } from './pdf/report-parser.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
  ) {}

  findAll() {
    return this.reports.find({
      relations: { parameters: true },
      order: { createdAt: 'DESC', parameters: { position: 'ASC' } },
    });
  }

  async create(file: Express.Multer.File) {
    if (!isPdf(file.buffer)) {
      throw new BadRequestException('Only PDF files can be uploaded');
    }

    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    if (await this.reports.existsBy({ fileHash })) {
      throw new ConflictException('This PDF has already been uploaded');
    }

    let pages: TextItem[][];
    try {
      pages = await readPdfPages(file.buffer);
    } catch {
      throw new BadRequestException(
        'This PDF is damaged and could not be read',
      );
    }

    const { reportCode, parameters } = parseReport(pages);
    if (parameters.length === 0) {
      throw new UnprocessableEntityException(
        'Could not find a test results table in this PDF',
      );
    }

    const report = this.reports.create({
      reportCode: reportCode ?? `AUTO-${fileHash.slice(0, 8).toUpperCase()}`,
      fileName: file.originalname,
      fileHash,
      parameters: parameters.map((parameter, index) => ({
        ...parameter,
        position: index + 1,
      })),
    });

    try {
      return await this.reports.save(report);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException(
          `Report ${report.reportCode} has already been uploaded`,
        );
      }
      throw error;
    }
  }
}

// every PDF starts with "%PDF-", usually right at the beginning
function isPdf(buffer: Buffer) {
  return buffer.subarray(0, 1024).includes('%PDF-');
}
