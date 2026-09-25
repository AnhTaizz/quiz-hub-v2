create table _oauth2_login_ticket (token varchar(64) not null, user_id bigint not null, created_at timestamp(6), consumed_at timestamp(6), expires_at timestamp(6) not null, primary key (token));
alter table if exists _oauth2_login_ticket add constraint FK_oauth2_login_ticket_user foreign key (user_id) references _user on delete cascade;
