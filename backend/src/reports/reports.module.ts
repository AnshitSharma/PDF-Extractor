import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity.js';
import { ReportParameter } from './entities/report-parameter.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Report, ReportParameter])],
})
export class ReportsModule {}
