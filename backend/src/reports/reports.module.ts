import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from './entities/report.entity.js';
import { ReportParameter } from './entities/report-parameter.entity.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Report, ReportParameter])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
