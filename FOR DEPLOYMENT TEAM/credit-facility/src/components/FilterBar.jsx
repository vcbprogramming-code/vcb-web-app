// The filter bar above every table.
//
// Company, type, project, period, status and free text — the same six controls
// the Apps Script app had, reading and writing FilterContext so the dashboard's
// drill-downs and this bar stay one source of truth.

import React from 'react';
import { useT } from '@vcb/shared';
import { useData } from '../lib/DataContext.jsx';
import { useFilters } from '../lib/FilterContext.jsx';
import { companies, projName } from '../lib/lookups.js';
import { STATUS } from '../lib/domain.js';
import { Button, Input, Select } from './ui.jsx';

export default function FilterBar({ onAddRequest, onAddTxn, onExport }) {
  const t = useT();
  const { projects, facTypes, isManager } = useData();
  const { filters, setFilter } = useFilters();

  const companyList = companies(projects);

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
      <Select
        value={filters.co}
        onChange={(e) => setFilter('co', e.target.value)}
        title={t('filter.company')}
        aria-label={t('filter.company')}
        className="w-auto min-w-[9rem] max-w-[16rem]"
      >
        <option value="">{t('filter.allCompanies')}</option>
        {companyList.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>

      <Select
        value={filters.type}
        onChange={(e) => setFilter('type', e.target.value)}
        title={t('filter.facilityType')}
        aria-label={t('filter.facilityType')}
        className="w-auto min-w-[9rem] max-w-[16rem]"
      >
        <option value="">{t('filter.allTypes')}</option>
        {[...new Set(facTypes.map((x) => x.kind).filter(Boolean))].map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </Select>

      <Select
        value={filters.proj}
        onChange={(e) => setFilter('proj', e.target.value)}
        title={t('filter.project')}
        aria-label={t('filter.project')}
        className="w-auto min-w-[9rem] max-w-[18rem]"
      >
        <option value="">{t('filter.allProjects')}</option>
        {projects.map((p) => (
          <option key={p.code} value={p.code}>
            {projName(projects, p.code)}
          </option>
        ))}
      </Select>

      <Select
        value={filters.due}
        onChange={(e) => setFilter('due', e.target.value)}
        title={t('filter.period')}
        aria-label={t('filter.period')}
        className="w-auto min-w-[8rem]"
      >
        <option value="">{t('filter.allPeriods')}</option>
        <option value="week">{t('filter.due7')}</option>
        <option value="this">{t('filter.thisMonth')}</option>
        <option value="next">{t('filter.nextMonth')}</option>
        <option value="overdue">{t('filter.overdue')}</option>
      </Select>

      <Select
        value={filters.status}
        onChange={(e) => setFilter('status', e.target.value)}
        title={t('filter.status')}
        aria-label={t('filter.status')}
        className="w-auto min-w-[8rem]"
      >
        <option value="">{t('filter.allStatuses')}</option>
        <option value={STATUS.NEW}>{t('status.new')}</option>
        <option value={STATUS.PENDING}>{t('status.pending')}</option>
        <option value={STATUS.APPROVED}>{t('status.approved')}</option>
        <option value={STATUS.SETTLED}>{t('status.settled')}</option>
      </Select>

      <Input
        value={filters.q}
        onChange={(e) => setFilter('q', e.target.value)}
        placeholder={t('filter.search')}
        title={t('filter.searchTitle')}
        aria-label={t('filter.searchTitle')}
        className="min-w-[10rem] flex-1"
      />

      {/* One group so the three action buttons wrap together onto their own
          line rather than Export Excel wrapping alone after the other two —
          the filters above can wrap freely, but these read as one unit.
          ml-auto pushes the whole group to the right on that line, matching
          the original — left-aligned read as if it belonged with the filters
          rather than as the row's own distinct action bar. */}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {isManager ? (
          <>
            <Button onClick={onAddRequest}>{t('action.addRequest')}</Button>
            <Button variant="ghost" onClick={onAddTxn}>
              {t('action.addTxn')}
            </Button>
          </>
        ) : null}
        <Button variant="ghost" onClick={onExport}>
          {t('action.exportExcel')}
        </Button>
      </div>
    </div>
  );
}
