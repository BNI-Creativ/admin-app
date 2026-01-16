// Database Service - SQLite/localStorage for offline-first functionality
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

class DatabaseService {
  sqlite = null;
  db = null;
  platform = Capacitor.getPlatform();
  initialized = false;
  useLocalStorage = false;

  async initialize() {
    if (this.initialized) return;

    try {
      // On web or if SQLite fails, use localStorage
      if (this.platform === 'web') {
        console.log('Running on web - using localStorage');
        this.useLocalStorage = true;
        this.initLocalStorage();
        this.initialized = true;
        return;
      }

      // On native platforms, try SQLite
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
      this.db = await this.sqlite.createConnection('bni_prezenta', false, 'no-encryption', 1, false);
      await this.db.open();
      await this.createTables();
      this.initialized = true;
      console.log('SQLite initialized');
    } catch (error) {
      console.warn('SQLite failed, using localStorage:', error.message);
      this.useLocalStorage = true;
      this.initLocalStorage();
      this.initialized = true;
    }
  }

  initLocalStorage() {
    ['members', 'attendance', 'guests', 'monthly_totals', 'sync_log'].forEach(key => {
      if (!localStorage.getItem(`bni_${key}`)) {
        localStorage.setItem(`bni_${key}`, JSON.stringify([]));
      }
    });
  }

  getLS(key) { return JSON.parse(localStorage.getItem(`bni_${key}`) || '[]'); }
  setLS(key, data) { localStorage.setItem(`bni_${key}`, JSON.stringify(data)); }

  async createTables() {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, nr INTEGER, prenume TEXT, nume TEXT, created_at TEXT, updated_at TEXT, synced INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, member_id TEXT, data TEXT, prezent INTEGER DEFAULT 0, taxa REAL DEFAULT 0, nume_inlocuitor TEXT, created_at TEXT, updated_at TEXT, synced INTEGER DEFAULT 0, UNIQUE(member_id, data));
      CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY, nr INTEGER, prenume TEXT, nume TEXT, companie TEXT, invitat_de TEXT, taxa REAL DEFAULT 0, data TEXT, is_inlocuitor INTEGER DEFAULT 0, member_id TEXT, created_at TEXT, updated_at TEXT, synced INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, last_sync TEXT, status TEXT, details TEXT);
      CREATE TABLE IF NOT EXISTS monthly_totals (id TEXT PRIMARY KEY, member_id TEXT, month TEXT, total_taxa REAL DEFAULT 0, updated_at TEXT, synced INTEGER DEFAULT 0, UNIQUE(member_id, month));
    `);
  }

  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  now() { return new Date().toISOString(); }

  // ==================== MEMBERS ====================
  async getMembers() {
    if (this.useLocalStorage) {
      return this.getLS('members').sort((a, b) => 
        `${a.prenume} ${a.nume}`.localeCompare(`${b.prenume} ${b.nume}`)
      );
    }
    const result = await this.db.query('SELECT * FROM members ORDER BY prenume, nume');
    return result.values || [];
  }

  async getMemberById(id) {
    if (this.useLocalStorage) {
      return this.getLS('members').find(m => m.id === id) || null;
    }
    const result = await this.db.query('SELECT * FROM members WHERE id = ?', [id]);
    return result.values?.[0] || null;
  }

  async addMember(member) {
    const id = member.id || this.generateId();
    const now = this.now();
    const newMember = { ...member, id, nr: member.nr || 0, created_at: now, updated_at: now, synced: 0 };
    
    if (this.useLocalStorage) {
      const members = this.getLS('members');
      members.push(newMember);
      this.setLS('members', members);
    } else {
      await this.db.run(
        `INSERT INTO members (id, nr, prenume, nume, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [id, member.nr || 0, member.prenume, member.nume, now, now]
      );
    }
    return newMember;
  }

  async updateMember(id, member) {
    const now = this.now();
    if (this.useLocalStorage) {
      const members = this.getLS('members');
      const idx = members.findIndex(m => m.id === id);
      if (idx >= 0) {
        members[idx] = { ...members[idx], ...member, updated_at: now, synced: 0 };
        this.setLS('members', members);
        return members[idx];
      }
    } else {
      await this.db.run(
        `UPDATE members SET prenume = ?, nume = ?, nr = ?, updated_at = ?, synced = 0 WHERE id = ?`,
        [member.prenume, member.nume, member.nr || 0, now, id]
      );
    }
    return { ...member, id, updated_at: now, synced: 0 };
  }

  async deleteMember(id) {
    if (this.useLocalStorage) {
      this.setLS('members', this.getLS('members').filter(m => m.id !== id));
      this.setLS('attendance', this.getLS('attendance').filter(a => a.member_id !== id));
      this.setLS('guests', this.getLS('guests').filter(g => g.member_id !== id));
    } else {
      await this.db.run('DELETE FROM members WHERE id = ?', [id]);
      await this.db.run('DELETE FROM attendance WHERE member_id = ?', [id]);
      await this.db.run('DELETE FROM guests WHERE member_id = ?', [id]);
    }
  }

  // ==================== ATTENDANCE ====================
  async getAttendanceByDate(date) {
    const members = await this.getMembers();
    let attendance, monthlyTotals;
    const month = date.substring(0, 7);

    if (this.useLocalStorage) {
      attendance = this.getLS('attendance').filter(a => a.data === date);
      monthlyTotals = this.getLS('monthly_totals').filter(m => m.month === month);
    } else {
      const attResult = await this.db.query('SELECT * FROM attendance WHERE data = ?', [date]);
      attendance = attResult.values || [];
      const mtResult = await this.db.query('SELECT * FROM monthly_totals WHERE month = ?', [month]);
      monthlyTotals = mtResult.values || [];
    }

    const membriWithAttendance = members.map((member, index) => {
      const att = attendance.find(a => a.member_id === member.id) || {};
      const monthTotal = monthlyTotals.find(m => m.member_id === member.id);
      return {
        ...member,
        nr: index + 1,
        prezent: this.useLocalStorage ? att.prezent : att.prezent === 1,
        taxa: att.taxa || 0,
        nume_inlocuitor: att.nume_inlocuitor || '',
        taxa_lunara: monthTotal?.total_taxa || 0
      };
    });

    let invitati;
    if (this.useLocalStorage) {
      invitati = this.getLS('guests').filter(g => g.data === date).sort((a, b) => a.nr - b.nr);
    } else {
      const guestResult = await this.db.query('SELECT * FROM guests WHERE data = ? ORDER BY nr', [date]);
      invitati = (guestResult.values || []).map(g => ({ ...g, is_inlocuitor: g.is_inlocuitor === 1 }));
    }
    invitati = invitati.map((g, i) => ({ ...g, nr: i + 1 }));

    return {
      membri: membriWithAttendance,
      invitati,
      total_taxa_membri: membriWithAttendance.reduce((sum, m) => sum + (m.taxa || 0), 0),
      total_taxa_invitati: invitati.reduce((sum, g) => sum + (g.taxa || 0), 0)
    };
  }

  async saveAttendance(date, memberId, prezent, taxa, numeInlocuitor) {
    const now = this.now();
    const id = `${memberId}_${date}`;
    const record = { id, member_id: memberId, data: date, prezent, taxa, nume_inlocuitor: numeInlocuitor || '', created_at: now, updated_at: now, synced: 0 };

    if (this.useLocalStorage) {
      const attendance = this.getLS('attendance');
      const idx = attendance.findIndex(a => a.member_id === memberId && a.data === date);
      if (idx >= 0) {
        attendance[idx] = { ...attendance[idx], ...record };
      } else {
        attendance.push(record);
      }
      this.setLS('attendance', attendance);
    } else {
      await this.db.run(
        `INSERT INTO attendance (id, member_id, data, prezent, taxa, nume_inlocuitor, created_at, updated_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(member_id, data) DO UPDATE SET prezent=excluded.prezent, taxa=excluded.taxa, nume_inlocuitor=excluded.nume_inlocuitor, updated_at=excluded.updated_at, synced=0`,
        [id, memberId, date, prezent ? 1 : 0, taxa, numeInlocuitor || '', now, now]
      );
    }

    await this.updateMonthlyTotal(memberId, date);
    return record;
  }

  async updateMonthlyTotal(memberId, date) {
    const month = date.substring(0, 7);
    const now = this.now();
    let totalTaxa = 0;

    if (this.useLocalStorage) {
      totalTaxa = this.getLS('attendance')
        .filter(a => a.member_id === memberId && a.data.startsWith(month))
        .reduce((sum, a) => sum + (a.taxa || 0), 0);
      
      const totals = this.getLS('monthly_totals');
      const idx = totals.findIndex(t => t.member_id === memberId && t.month === month);
      const record = { id: `${memberId}_${month}`, member_id: memberId, month, total_taxa: totalTaxa, updated_at: now, synced: 0 };
      if (idx >= 0) {
        totals[idx] = record;
      } else {
        totals.push(record);
      }
      this.setLS('monthly_totals', totals);
    } else {
      const result = await this.db.query(`SELECT SUM(taxa) as total FROM attendance WHERE member_id = ? AND data LIKE ?`, [memberId, `${month}%`]);
      totalTaxa = result.values?.[0]?.total || 0;
      await this.db.run(
        `INSERT INTO monthly_totals (id, member_id, month, total_taxa, updated_at, synced) VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(member_id, month) DO UPDATE SET total_taxa=excluded.total_taxa, updated_at=excluded.updated_at, synced=0`,
        [`${memberId}_${month}`, memberId, month, totalTaxa, now]
      );
    }
    return totalTaxa;
  }

  // ==================== GUESTS ====================
  async addGuest(guest) {
    const id = guest.id || this.generateId();
    const now = this.now();
    let nr = 1;

    if (this.useLocalStorage) {
      nr = this.getLS('guests').filter(g => g.data === guest.data).length + 1;
    } else {
      const countResult = await this.db.query('SELECT COUNT(*) as count FROM guests WHERE data = ?', [guest.data]);
      nr = (countResult.values?.[0]?.count || 0) + 1;
    }

    const newGuest = { ...guest, id, nr, created_at: now, updated_at: now, synced: 0 };

    if (this.useLocalStorage) {
      const guests = this.getLS('guests');
      guests.push(newGuest);
      this.setLS('guests', guests);
    } else {
      await this.db.run(
        `INSERT INTO guests (id, nr, prenume, nume, companie, invitat_de, taxa, data, is_inlocuitor, member_id, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [id, nr, guest.prenume, guest.nume, guest.companie || '', guest.invitat_de || '', guest.taxa || 0, guest.data, guest.is_inlocuitor ? 1 : 0, guest.member_id || null, now, now]
      );
    }
    return newGuest;
  }

  async updateGuest(id, guest) {
    const now = this.now();
    if (this.useLocalStorage) {
      const guests = this.getLS('guests');
      const idx = guests.findIndex(g => g.id === id);
      if (idx >= 0) {
        guests[idx] = { ...guests[idx], ...guest, updated_at: now, synced: 0 };
        this.setLS('guests', guests);
        return guests[idx];
      }
    } else {
      await this.db.run(
        `UPDATE guests SET prenume=?, nume=?, companie=?, invitat_de=?, taxa=?, updated_at=?, synced=0 WHERE id=?`,
        [guest.prenume, guest.nume, guest.companie || '', guest.invitat_de || '', guest.taxa || 0, now, id]
      );
    }
    return { ...guest, id, updated_at: now, synced: 0 };
  }

  async deleteGuest(id) {
    if (this.useLocalStorage) {
      this.setLS('guests', this.getLS('guests').filter(g => g.id !== id));
    } else {
      await this.db.run('DELETE FROM guests WHERE id = ?', [id]);
    }
  }

  async getGuestByMemberId(memberId, date) {
    if (this.useLocalStorage) {
      return this.getLS('guests').find(g => g.member_id === memberId && g.data === date && g.is_inlocuitor) || null;
    }
    const result = await this.db.query('SELECT * FROM guests WHERE member_id = ? AND data = ? AND is_inlocuitor = 1', [memberId, date]);
    return result.values?.[0] || null;
  }

  // ==================== DATES WITH DATA ====================
  async getDatesWithData() {
    if (this.useLocalStorage) {
      const dates = new Set([
        ...this.getLS('attendance').map(a => a.data),
        ...this.getLS('guests').map(g => g.data)
      ]);
      return [...dates].sort().reverse();
    }
    const result = await this.db.query('SELECT DISTINCT data FROM attendance ORDER BY data DESC');
    return (result.values || []).map(r => r.data);
  }

  // ==================== SYNC ====================
  async getUnsyncedData() {
    if (this.useLocalStorage) {
      return {
        members: this.getLS('members').filter(m => m.synced === 0),
        attendance: this.getLS('attendance').filter(a => a.synced === 0),
        guests: this.getLS('guests').filter(g => g.synced === 0),
        monthly_totals: this.getLS('monthly_totals').filter(m => m.synced === 0)
      };
    }
    const members = await this.db.query('SELECT * FROM members WHERE synced = 0');
    const attendance = await this.db.query('SELECT * FROM attendance WHERE synced = 0');
    const guests = await this.db.query('SELECT * FROM guests WHERE synced = 0');
    const monthlyTotals = await this.db.query('SELECT * FROM monthly_totals WHERE synced = 0');
    return {
      members: members.values || [],
      attendance: attendance.values || [],
      guests: guests.values || [],
      monthly_totals: monthlyTotals.values || []
    };
  }

  async markAsSynced(table, ids) {
    if (ids.length === 0) return;
    if (this.useLocalStorage) {
      const data = this.getLS(table);
      data.forEach(item => {
        if (ids.includes(item.id)) item.synced = 1;
      });
      this.setLS(table, data);
    } else {
      const placeholders = ids.map(() => '?').join(',');
      await this.db.run(`UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`, ids);
    }
  }

  async getLastSyncTime() {
    if (this.useLocalStorage) {
      const logs = this.getLS('sync_log');
      return logs.length > 0 ? logs[logs.length - 1].last_sync : null;
    }
    const result = await this.db.query('SELECT last_sync FROM sync_log ORDER BY id DESC LIMIT 1');
    return result.values?.[0]?.last_sync || null;
  }

  async logSync(status, details = '') {
    const record = { last_sync: this.now(), status, details };
    if (this.useLocalStorage) {
      const logs = this.getLS('sync_log');
      logs.push(record);
      this.setLS('sync_log', logs.slice(-100)); // Keep last 100 logs
    } else {
      await this.db.run('INSERT INTO sync_log (last_sync, status, details) VALUES (?, ?, ?)', [record.last_sync, status, details]);
    }
  }

  async importFromServer(data) {
    for (const member of data.members || []) {
      const existing = await this.getMemberById(member.id);
      if (!existing) {
        if (this.useLocalStorage) {
          const members = this.getLS('members');
          members.push({ ...member, synced: 1 });
          this.setLS('members', members);
        } else {
          await this.db.run(
            `INSERT INTO members (id, nr, prenume, nume, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [member.id, member.nr || 0, member.prenume, member.nume, member.created_at || this.now(), member.updated_at || this.now()]
          );
        }
      }
    }
    // Similar for attendance and guests - only add if not exists locally
  }

  async close() {
    if (this.db) {
      await this.db.close();
      await this.sqlite.closeConnection('bni_prezenta', false);
    }
  }
}

const dbService = new DatabaseService();
export default dbService;
