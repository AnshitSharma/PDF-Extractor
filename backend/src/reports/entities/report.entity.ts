import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReportParameter } from './report-parameter.entity.js';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'report_code', unique: true })
  reportCode: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_hash', type: 'char', length: 64, unique: true })
  fileHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ReportParameter, (parameter) => parameter.report, {
    cascade: true,
  })
  parameters: ReportParameter[];
}
