// Database Service - SQLite local storage for offline-first functionality
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

class DatabaseService {
  sqlite = new SQLiteConnection(CapacitorSQLite);
  db = null;
  platform = Capacitor.getPlatform();
  initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      if (this.platform === 'web') {
        // For web/browser testing, use jeep-sqlite
        const jeepSqliteEl = document.querySelector('jeep-sqlite');
        if (jeepSqliteEl != null) {
          await customElements.whenDefined('jeep-sqlite');
          await this.sqlite.initWebStore();
        }
      }

      // Create/open database
      this.db = await this.sqlite.createConnection(
        'bni_prezenta',
        false,
        'no-encryption',
        1,
        false
      );

      await this.db.open();
      await this.createTables();
      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        nr INTEGER,
        prenume TEXT NOT NULL,
        nume TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        data TEXT NOT NULL,
        prezent INTEGER DEFAULT 0,
        taxa REAL DEFAULT 0,
        nume_inlocuitor TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        UNIQUE(member_id, data)
      );

      CREATE TABLE IF NOT EXISTS guests (
        id TEXT PRIMARY KEY,
        nr INTEGER,
        prenume TEXT NOT NULL,
        nume TEXT NOT NULL,
        companie TEXT,
        invitat_de TEXT,
        taxa REAL DEFAULT 0,
        data TEXT NOT NULL,
        is_inlocuitor INTEGER DEFAULT 0,
        member_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_sync TEXT,
        status TEXT,
        details TEXT
      );

      CREATE TABLE IF NOT EXISTS monthly_totals (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        month TEXT NOT NULL,
        total_taxa REAL DEFAULT 0,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        UNIQUE(member_id, month)
      );
    `;

    await this.db.execute(createTablesSQL);
  }

  // Generate UUID
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get current timestamp
  now() {
    return new Date().toISOString();
  }

  // ==================== MEMBERS ====================

  async getMembers() {
    const result = await this.db.query('SELECT * FROM members ORDER BY prenume, nume');
    return result.values || [];
  }

  async getMemberById(id) {
    const result = await this.db.query('SELECT * FROM members WHERE id = ?', [id]);
    return result.values?.[0] || null;
  }

  async addMember(member) {
    const id = member.id || this.generateId();
    const now = this.now();
    
    await this.db.run(
      `INSERT INTO members (id, nr, prenume, nume, created_at, updated_at, synced) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, member.nr || 0, member.prenume, member.nume, now, now]
    );
    
    return { ...member, id, created_at: now, updated_at: now, synced: 0 };
  }

  async updateMember(id, member) {
    const now = this.now();
    await this.db.run(
      `UPDATE members SET prenume = ?, nume = ?, nr = ?, updated_at = ?, synced = 0 
       WHERE id = ?`,
      [member.prenume, member.nume, member.nr || 0, now, id]
    );
    return { ...member, id, updated_at: now, synced: 0 };
  }

  async deleteMember(id) {
    await this.db.run('DELETE FROM members WHERE id = ?', [id]);
    await this.db.run('DELETE FROM attendance WHERE member_id = ?', [id]);
    await this.db.run('DELETE FROM guests WHERE member_id = ?', [id]);
  }

  // ==================== ATTENDANCE ====================

  async getAttendanceByDate(date) {
    const members = await this.getMembers();
    const attendanceResult = await this.db.query(
      'SELECT * FROM attendance WHERE data = ?',
      [date]
    );
    const attendance = attendanceResult.values || [];

    // Get monthly totals for current month
    const month = date.substring(0, 7); // YYYY-MM
    const monthlyResult = await this.db.query(
      'SELECT * FROM monthly_totals WHERE month = ?',
      [month]
    );
    const monthlyTotals = monthlyResult.values || [];

    // Merge members with attendance data
    const membriWithAttendance = members.map((member, index) => {
      const att = attendance.find(a => a.member_id === member.id) || {};
      const monthTotal = monthlyTotals.find(m => m.member_id === member.id);
      
      return {
        ...member,
        nr: index + 1,
        prezent: att.prezent === 1,
        taxa: att.taxa || 0,
        nume_inlocuitor: att.nume_inlocuitor || '',
        taxa_lunara: monthTotal?.total_taxa || 0
      };
    });

    // Get guests for this date
    const guestsResult = await this.db.query(
      'SELECT * FROM guests WHERE data = ? ORDER BY nr',
      [date]
    );
    const invitati = (guestsResult.values || []).map((g, index) => ({
      ...g,
      nr: index + 1,
      is_inlocuitor: g.is_inlocuitor === 1
    }));

    const totalTaxaMembri = membriWithAttendance.reduce((sum, m) => sum + (m.taxa || 0), 0);
    const totalTaxaInvitati = invitati.reduce((sum, g) => sum + (g.taxa || 0), 0);

    return {
      membri: membriWithAttendance,
      invitati,
      total_taxa_membri: totalTaxaMembri,
      total_taxa_invitati: totalTaxaInvitati
    };
  }

  async saveAttendance(date, memberId, prezent, taxa, numeInlocuitor) {
    const now = this.now();
    const id = `${memberId}_${date}`;
    
    // Upsert attendance
    await this.db.run(
      `INSERT INTO attendance (id, member_id, data, prezent, taxa, nume_inlocuitor, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(member_id, data) DO UPDATE SET
       prezent = excluded.prezent,
       taxa = excluded.taxa,
       nume_inlocuitor = excluded.nume_inlocuitor,
       updated_at = excluded.updated_at,
       synced = 0`,
      [id, memberId, date, prezent ? 1 : 0, taxa, numeInlocuitor || '', now, now]
    );

    // Update monthly total
    await this.updateMonthlyTotal(memberId, date);

    return { id, member_id: memberId, data: date, prezent, taxa, nume_inlocuitor: numeInlocuitor };
  }

  async updateMonthlyTotal(memberId, date) {
    const month = date.substring(0, 7);
    const now = this.now();
    
    // Calculate total for the month
    const result = await this.db.query(
      `SELECT SUM(taxa) as total FROM attendance 
       WHERE member_id = ? AND data LIKE ?`,
      [memberId, `${month}%`]
    );
    
    const totalTaxa = result.values?.[0]?.total || 0;
    const id = `${memberId}_${month}`;

    await this.db.run(
      `INSERT INTO monthly_totals (id, member_id, month, total_taxa, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(member_id, month) DO UPDATE SET
       total_taxa = excluded.total_taxa,
       updated_at = excluded.updated_at,
       synced = 0`,
      [id, memberId, month, totalTaxa, now]
    );

    return totalTaxa;
  }

  // ==================== GUESTS ====================

  async addGuest(guest) {
    const id = guest.id || this.generateId();
    const now = this.now();
    
    // Get next nr for this date
    const countResult = await this.db.query(
      'SELECT COUNT(*) as count FROM guests WHERE data = ?',
      [guest.data]
    );
    const nr = (countResult.values?.[0]?.count || 0) + 1;

    await this.db.run(
      `INSERT INTO guests (id, nr, prenume, nume, companie, invitat_de, taxa, data, is_inlocuitor, member_id, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, nr, guest.prenume, guest.nume, guest.companie || '', guest.invitat_de || '', 
       guest.taxa || 0, guest.data, guest.is_inlocuitor ? 1 : 0, guest.member_id || null, now, now]
    );

    return { ...guest, id, nr, created_at: now, updated_at: now, synced: 0 };
  }

  async updateGuest(id, guest) {
    const now = this.now();
    await this.db.run(
      `UPDATE guests SET prenume = ?, nume = ?, companie = ?, invitat_de = ?, taxa = ?, updated_at = ?, synced = 0
       WHERE id = ?`,
      [guest.prenume, guest.nume, guest.companie || '', guest.invitat_de || '', guest.taxa || 0, now, id]
    );
    return { ...guest, id, updated_at: now, synced: 0 };
  }

  async deleteGuest(id) {
    await this.db.run('DELETE FROM guests WHERE id = ?', [id]);
  }

  async getGuestByMemberId(memberId, date) {
    const result = await this.db.query(
      'SELECT * FROM guests WHERE member_id = ? AND data = ? AND is_inlocuitor = 1',
      [memberId, date]
    );
    return result.values?.[0] || null;
  }

  // ==================== DATES WITH DATA ====================

  async getDatesWithData() {
    const result = await this.db.query(
      'SELECT DISTINCT data FROM attendance ORDER BY data DESC'
    );
    return (result.values || []).map(r => r.data);
  }

  // ==================== SYNC ====================

  async getUnsyncedData() {
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
    const placeholders = ids.map(() => '?').join(',');
    await this.db.run(
      `UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`,
      ids
    );
  }

  async getLastSyncTime() {
    const result = await this.db.query(
      'SELECT last_sync FROM sync_log ORDER BY id DESC LIMIT 1'
    );
    return result.values?.[0]?.last_sync || null;
  }

  async logSync(status, details = '') {
    await this.db.run(
      'INSERT INTO sync_log (last_sync, status, details) VALUES (?, ?, ?)',
      [this.now(), status, details]
    );
  }

  async importFromServer(data) {
    // Import members
    for (const member of data.members || []) {
      const existing = await this.getMemberById(member.id);
      if (!existing) {
        await this.db.run(
          `INSERT INTO members (id, nr, prenume, nume, created_at, updated_at, synced)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [member.id, member.nr || 0, member.prenume, member.nume, 
           member.created_at || this.now(), member.updated_at || this.now()]
        );
      }
    }

    // Import attendance
    for (const att of data.attendance || []) {
      await this.db.run(
        `INSERT INTO attendance (id, member_id, data, prezent, taxa, nume_inlocuitor, created_at, updated_at, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(member_id, data) DO UPDATE SET
         prezent = CASE WHEN attendance.synced = 0 THEN attendance.prezent ELSE excluded.prezent END,
         taxa = CASE WHEN attendance.synced = 0 THEN attendance.taxa ELSE excluded.taxa END,
         nume_inlocuitor = CASE WHEN attendance.synced = 0 THEN attendance.nume_inlocuitor ELSE excluded.nume_inlocuitor END`,
        [att.id || `${att.member_id}_${att.data}`, att.member_id, att.data, 
         att.prezent ? 1 : 0, att.taxa || 0, att.nume_inlocuitor || '',
         att.created_at || this.now(), att.updated_at || this.now()]
      );
    }

    // Import guests
    for (const guest of data.guests || []) {
      const existingResult = await this.db.query('SELECT id FROM guests WHERE id = ?', [guest.id]);
      if (!existingResult.values?.length) {
        await this.db.run(
          `INSERT INTO guests (id, nr, prenume, nume, companie, invitat_de, taxa, data, is_inlocuitor, member_id, created_at, updated_at, synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [guest.id, guest.nr || 0, guest.prenume, guest.nume, guest.companie || '',
           guest.invitat_de || '', guest.taxa || 0, guest.data, guest.is_inlocuitor ? 1 : 0,
           guest.member_id || null, guest.created_at || this.now(), guest.updated_at || this.now()]
        );
      }
    }
  }

  async close() {
    if (this.db) {
      await this.db.close();
      await this.sqlite.closeConnection('bni_prezenta', false);
    }
  }
}

// Singleton instance
const dbService = new DatabaseService();
export default dbService;
