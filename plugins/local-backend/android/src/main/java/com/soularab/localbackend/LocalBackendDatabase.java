package com.soularab.localbackend;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

final class LocalBackendDatabase extends SQLiteOpenHelper {
    private static final String DB_NAME = "soularab_embedded_backend.db";
    private static final int DB_VERSION = 5;

    LocalBackendDatabase(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onConfigure(SQLiteDatabase db) {
        super.onConfigure(db);
        db.setForeignKeyConstraintsEnabled(true);
        db.enableWriteAheadLogging();
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE node_tasks (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "node_id TEXT NOT NULL," +
            "task_type TEXT NOT NULL," +
            "payload TEXT NOT NULL," +
            "status TEXT NOT NULL DEFAULT 'queued'," +
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "priority INTEGER NOT NULL DEFAULT 0," +
            "result TEXT NOT NULL DEFAULT ''," +
            "attempt_count INTEGER NOT NULL DEFAULT 0," +
            "max_attempts INTEGER NOT NULL DEFAULT 3," +
            "cancel_requested INTEGER NOT NULL DEFAULT 0," +
            "started_at TEXT," +
            "finished_at TEXT)");
        db.execSQL("CREATE INDEX idx_node_tasks_node_status ON node_tasks(node_id, status)");
        db.execSQL("CREATE INDEX idx_node_tasks_queue ON node_tasks(node_id, status, priority, id)");
        db.execSQL("CREATE TABLE local_sections (" +
            "id TEXT PRIMARY KEY," +
            "section_name TEXT NOT NULL," +
            "content TEXT NOT NULL," +
            "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
        db.execSQL("CREATE TABLE node_events (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "node_id TEXT NOT NULL," +
            "event TEXT NOT NULL," +
            "details TEXT NOT NULL DEFAULT '{}'," +
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
        db.execSQL("CREATE TABLE IF NOT EXISTS node_approvals (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "task_id INTEGER REFERENCES node_tasks(id) ON DELETE CASCADE," +
            "title TEXT NOT NULL," +
            "description TEXT NOT NULL DEFAULT ''," +
            "risk TEXT NOT NULL DEFAULT 'medium'," +
            "status TEXT NOT NULL DEFAULT 'pending'," +
            "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "decided_at TEXT," +
            "decision_note TEXT NOT NULL DEFAULT '')");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_node_approvals_status ON node_approvals(status, id)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE node_tasks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0");
        }
        if (oldVersion < 3) {
            db.execSQL("ALTER TABLE node_tasks ADD COLUMN result TEXT NOT NULL DEFAULT ''");
        }
        if (oldVersion < 5) {
            db.execSQL("ALTER TABLE node_tasks ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE node_tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3");
            db.execSQL("ALTER TABLE node_tasks ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE node_tasks ADD COLUMN started_at TEXT");
            db.execSQL("ALTER TABLE node_tasks ADD COLUMN finished_at TEXT");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_node_tasks_queue ON node_tasks(node_id, status, priority, id)");
        }
        if (oldVersion < 4) {
            db.execSQL("CREATE TABLE IF NOT EXISTS node_approvals (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "task_id INTEGER REFERENCES node_tasks(id) ON DELETE CASCADE," +
                "title TEXT NOT NULL," +
                "description TEXT NOT NULL DEFAULT ''," +
                "risk TEXT NOT NULL DEFAULT 'medium'," +
                "status TEXT NOT NULL DEFAULT 'pending'," +
                "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "decided_at TEXT," +
                "decision_note TEXT NOT NULL DEFAULT '')");
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_node_approvals_status ON node_approvals(status, id)");
        }
    }
}
