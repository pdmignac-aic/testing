import sqlite3
import csv
import io
import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify, g, redirect, url_for

app = Flask(__name__)
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crm.db")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DATABASE)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            industry TEXT,
            website TEXT,
            phone TEXT,
            address TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT,
            email TEXT,
            phone TEXT,
            company_id INTEGER,
            job_title TEXT,
            status TEXT DEFAULT 'active',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            value REAL DEFAULT 0,
            currency TEXT DEFAULT 'USD',
            stage TEXT DEFAULT 'lead',
            contact_id INTEGER,
            company_id INTEGER,
            expected_close_date TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
            FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER,
            deal_id INTEGER,
            type TEXT DEFAULT 'note',
            subject TEXT,
            description TEXT,
            interaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
            FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL
        );
    """
    )
    db.commit()
    db.close()


# --- Dashboard ---
@app.route("/")
def dashboard():
    db = get_db()
    stats = {
        "total_contacts": db.execute("SELECT COUNT(*) FROM contacts").fetchone()[0],
        "total_companies": db.execute("SELECT COUNT(*) FROM companies").fetchone()[0],
        "total_deals": db.execute("SELECT COUNT(*) FROM deals").fetchone()[0],
        "total_deal_value": db.execute("SELECT COALESCE(SUM(value), 0) FROM deals").fetchone()[0],
        "deals_by_stage": [
            dict(r)
            for r in db.execute(
                "SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as total_value FROM deals GROUP BY stage ORDER BY count DESC"
            ).fetchall()
        ],
        "recent_interactions": [
            dict(r)
            for r in db.execute(
                """SELECT i.*, c.first_name, c.last_name
                   FROM interactions i
                   LEFT JOIN contacts c ON i.contact_id = c.id
                   ORDER BY i.interaction_date DESC LIMIT 10"""
            ).fetchall()
        ],
        "top_deals": [
            dict(r)
            for r in db.execute(
                """SELECT d.*, c.first_name, c.last_name, co.name as company_name
                   FROM deals d
                   LEFT JOIN contacts c ON d.contact_id = c.id
                   LEFT JOIN companies co ON d.company_id = co.id
                   ORDER BY d.value DESC LIMIT 10"""
            ).fetchall()
        ],
    }
    return render_template("dashboard.html", stats=stats)


# --- Contacts CRUD ---
@app.route("/contacts")
def contacts_list():
    db = get_db()
    contacts = db.execute(
        """SELECT c.*, co.name as company_name
           FROM contacts c
           LEFT JOIN companies co ON c.company_id = co.id
           ORDER BY c.created_at DESC"""
    ).fetchall()
    companies = db.execute("SELECT id, name FROM companies ORDER BY name").fetchall()
    return render_template("contacts.html", contacts=contacts, companies=companies)


@app.route("/contacts/add", methods=["POST"])
def contact_add():
    db = get_db()
    db.execute(
        """INSERT INTO contacts (first_name, last_name, email, phone, company_id, job_title, status, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            request.form["first_name"],
            request.form.get("last_name", ""),
            request.form.get("email", ""),
            request.form.get("phone", ""),
            request.form.get("company_id") or None,
            request.form.get("job_title", ""),
            request.form.get("status", "active"),
            request.form.get("notes", ""),
        ),
    )
    db.commit()
    return redirect(url_for("contacts_list"))


@app.route("/contacts/<int:id>/edit", methods=["POST"])
def contact_edit(id):
    db = get_db()
    db.execute(
        """UPDATE contacts SET first_name=?, last_name=?, email=?, phone=?,
           company_id=?, job_title=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (
            request.form["first_name"],
            request.form.get("last_name", ""),
            request.form.get("email", ""),
            request.form.get("phone", ""),
            request.form.get("company_id") or None,
            request.form.get("job_title", ""),
            request.form.get("status", "active"),
            request.form.get("notes", ""),
            id,
        ),
    )
    db.commit()
    return redirect(url_for("contacts_list"))


@app.route("/contacts/<int:id>/delete", methods=["POST"])
def contact_delete(id):
    db = get_db()
    db.execute("DELETE FROM contacts WHERE id=?", (id,))
    db.commit()
    return redirect(url_for("contacts_list"))


# --- Companies CRUD ---
@app.route("/companies")
def companies_list():
    db = get_db()
    companies = db.execute(
        """SELECT co.*, COUNT(c.id) as contact_count
           FROM companies co
           LEFT JOIN contacts c ON c.company_id = co.id
           GROUP BY co.id
           ORDER BY co.created_at DESC"""
    ).fetchall()
    return render_template("companies.html", companies=companies)


@app.route("/companies/add", methods=["POST"])
def company_add():
    db = get_db()
    db.execute(
        """INSERT INTO companies (name, industry, website, phone, address, notes)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            request.form["name"],
            request.form.get("industry", ""),
            request.form.get("website", ""),
            request.form.get("phone", ""),
            request.form.get("address", ""),
            request.form.get("notes", ""),
        ),
    )
    db.commit()
    return redirect(url_for("companies_list"))


@app.route("/companies/<int:id>/edit", methods=["POST"])
def company_edit(id):
    db = get_db()
    db.execute(
        """UPDATE companies SET name=?, industry=?, website=?, phone=?,
           address=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
        (
            request.form["name"],
            request.form.get("industry", ""),
            request.form.get("website", ""),
            request.form.get("phone", ""),
            request.form.get("address", ""),
            request.form.get("notes", ""),
            id,
        ),
    )
    db.commit()
    return redirect(url_for("companies_list"))


@app.route("/companies/<int:id>/delete", methods=["POST"])
def company_delete(id):
    db = get_db()
    db.execute("DELETE FROM companies WHERE id=?", (id,))
    db.commit()
    return redirect(url_for("companies_list"))


# --- Deals CRUD ---
@app.route("/deals")
def deals_list():
    db = get_db()
    deals = db.execute(
        """SELECT d.*, c.first_name, c.last_name, co.name as company_name
           FROM deals d
           LEFT JOIN contacts c ON d.contact_id = c.id
           LEFT JOIN companies co ON d.company_id = co.id
           ORDER BY d.created_at DESC"""
    ).fetchall()
    contacts = db.execute("SELECT id, first_name, last_name FROM contacts ORDER BY first_name").fetchall()
    companies = db.execute("SELECT id, name FROM companies ORDER BY name").fetchall()
    return render_template("deals.html", deals=deals, contacts=contacts, companies=companies)


@app.route("/deals/add", methods=["POST"])
def deal_add():
    db = get_db()
    db.execute(
        """INSERT INTO deals (title, value, currency, stage, contact_id, company_id, expected_close_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            request.form["title"],
            float(request.form.get("value", 0) or 0),
            request.form.get("currency", "USD"),
            request.form.get("stage", "lead"),
            request.form.get("contact_id") or None,
            request.form.get("company_id") or None,
            request.form.get("expected_close_date", ""),
            request.form.get("notes", ""),
        ),
    )
    db.commit()
    return redirect(url_for("deals_list"))


@app.route("/deals/<int:id>/edit", methods=["POST"])
def deal_edit(id):
    db = get_db()
    db.execute(
        """UPDATE deals SET title=?, value=?, currency=?, stage=?, contact_id=?,
           company_id=?, expected_close_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (
            request.form["title"],
            float(request.form.get("value", 0) or 0),
            request.form.get("currency", "USD"),
            request.form.get("stage", "lead"),
            request.form.get("contact_id") or None,
            request.form.get("company_id") or None,
            request.form.get("expected_close_date", ""),
            request.form.get("notes", ""),
            id,
        ),
    )
    db.commit()
    return redirect(url_for("deals_list"))


@app.route("/deals/<int:id>/delete", methods=["POST"])
def deal_delete(id):
    db = get_db()
    db.execute("DELETE FROM deals WHERE id=?", (id,))
    db.commit()
    return redirect(url_for("deals_list"))


# --- Interactions CRUD ---
@app.route("/interactions")
def interactions_list():
    db = get_db()
    interactions = db.execute(
        """SELECT i.*, c.first_name, c.last_name, d.title as deal_title
           FROM interactions i
           LEFT JOIN contacts c ON i.contact_id = c.id
           LEFT JOIN deals d ON i.deal_id = d.id
           ORDER BY i.interaction_date DESC"""
    ).fetchall()
    contacts = db.execute("SELECT id, first_name, last_name FROM contacts ORDER BY first_name").fetchall()
    deals = db.execute("SELECT id, title FROM deals ORDER BY title").fetchall()
    return render_template("interactions.html", interactions=interactions, contacts=contacts, deals=deals)


@app.route("/interactions/add", methods=["POST"])
def interaction_add():
    db = get_db()
    db.execute(
        """INSERT INTO interactions (contact_id, deal_id, type, subject, description, interaction_date)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            request.form.get("contact_id") or None,
            request.form.get("deal_id") or None,
            request.form.get("type", "note"),
            request.form.get("subject", ""),
            request.form.get("description", ""),
            request.form.get("interaction_date") or datetime.now().isoformat(),
        ),
    )
    db.commit()
    return redirect(url_for("interactions_list"))


@app.route("/interactions/<int:id>/delete", methods=["POST"])
def interaction_delete(id):
    db = get_db()
    db.execute("DELETE FROM interactions WHERE id=?", (id,))
    db.commit()
    return redirect(url_for("interactions_list"))


# --- SQL Query Interface ---
@app.route("/query")
def query_page():
    return render_template("query.html")


@app.route("/query/run", methods=["POST"])
def query_run():
    sql = request.json.get("sql", "").strip()
    if not sql:
        return jsonify({"error": "No SQL provided"}), 400

    # Only allow SELECT queries for safety
    if not sql.upper().startswith("SELECT"):
        return jsonify({"error": "Only SELECT queries are allowed for safety. Use the UI for modifications."}), 400

    try:
        db = get_db()
        cursor = db.execute(sql)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return jsonify({"columns": columns, "rows": rows, "count": len(rows)})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# --- CSV Import ---
@app.route("/import")
def import_page():
    return render_template("import.html")


@app.route("/import/csv", methods=["POST"])
def import_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    table = request.form.get("table", "contacts")

    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported"}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"))
        reader = csv.DictReader(stream)
        db = get_db()

        valid_tables = {
            "contacts": [
                "first_name", "last_name", "email", "phone",
                "job_title", "status", "notes",
            ],
            "companies": [
                "name", "industry", "website", "phone", "address", "notes",
            ],
            "deals": [
                "title", "value", "currency", "stage",
                "expected_close_date", "notes",
            ],
        }

        if table not in valid_tables:
            return jsonify({"error": f"Invalid table: {table}"}), 400

        allowed_cols = valid_tables[table]
        imported = 0

        for row in reader:
            # Map CSV columns to DB columns (case-insensitive matching)
            mapped = {}
            for csv_col, value in row.items():
                col_lower = csv_col.strip().lower().replace(" ", "_")
                if col_lower in allowed_cols:
                    mapped[col_lower] = value.strip() if value else ""

            if not mapped:
                continue

            cols = ", ".join(mapped.keys())
            placeholders = ", ".join(["?"] * len(mapped))
            db.execute(
                f"INSERT INTO {table} ({cols}) VALUES ({placeholders})",
                list(mapped.values()),
            )
            imported += 1

        db.commit()
        return jsonify({"success": True, "imported": imported})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# --- API for dashboard charts ---
@app.route("/api/dashboard-data")
def dashboard_data():
    db = get_db()
    return jsonify(
        {
            "deals_by_stage": [
                dict(r)
                for r in db.execute(
                    "SELECT stage, COUNT(*) as count, COALESCE(SUM(value),0) as total_value FROM deals GROUP BY stage"
                ).fetchall()
            ],
            "contacts_by_status": [
                dict(r)
                for r in db.execute(
                    "SELECT status, COUNT(*) as count FROM contacts GROUP BY status"
                ).fetchall()
            ],
            "deals_timeline": [
                dict(r)
                for r in db.execute(
                    """SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count,
                       COALESCE(SUM(value),0) as total_value
                       FROM deals GROUP BY month ORDER BY month DESC LIMIT 12"""
                ).fetchall()
            ],
            "top_companies": [
                dict(r)
                for r in db.execute(
                    """SELECT co.name, COUNT(d.id) as deal_count, COALESCE(SUM(d.value),0) as total_value
                       FROM companies co
                       LEFT JOIN deals d ON d.company_id = co.id
                       GROUP BY co.id ORDER BY total_value DESC LIMIT 10"""
                ).fetchall()
            ],
        }
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
