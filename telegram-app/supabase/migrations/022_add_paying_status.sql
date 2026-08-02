alter table lucky_draw_wins drop constraint if exists lucky_draw_wins_payout_status_check;
alter table lucky_draw_wins add constraint lucky_draw_wins_payout_status_check
  check (payout_status in ('pending', 'paying', 'paid', 'skipped'));
