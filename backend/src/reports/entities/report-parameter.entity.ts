import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Report } from './report.entity.js';

@Entity('report_parameters')
export class ReportParameter {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @ManyToOne(() => Report, (report) => report.parameters, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'report_id' })
  report: Relation<Report>;

  @Column()
  position: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  value: string | null;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  @Column({ name: 'reference_range', type: 'varchar', nullable: true })
  referenceRange: string | null;
}
