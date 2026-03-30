import sqlite3
import csv
import io
import os
from flask import Flask, render_template, request, jsonify, g, redirect, url_for

app = Flask(__name__)
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crm.db")

# All columns from the Google Sheet, mapped to DB-safe names
LEAD_COLUMNS = [
    ("company_name", "Company Name", "TEXT"),
    ("identifier", "Identifier", "TEXT"),
    ("duplicate", "Duplicate?", "TEXT"),
    ("status", "Status", "TEXT"),
    ("owner", "Owner", "TEXT"),
    ("layer", "Layer", "TEXT"),
    ("dirty_grade", "Dirty Grade", "TEXT"),
    ("component", "Component", "TEXT"),
    ("full_address", "Full Address", "TEXT"),
    ("street", "Street", "TEXT"),
    ("city", "City", "TEXT"),
    ("state", "State", "TEXT"),
    ("zip", "Zip", "TEXT"),
    ("country", "Country", "TEXT"),
    ("founding_year", "Founding Year", "TEXT"),
    ("ownership", "Ownership", "TEXT"),
    ("notes", "Notes", "TEXT"),
    ("contact_name", "Contact Name", "TEXT"),
    ("contact_title", "Contact Title", "TEXT"),
    ("email", "Email", "TEXT"),
    ("other", "Other", "TEXT"),
    ("warm_intro", "Warm Intro?", "TEXT"),
    ("phone_linkedin", "Phone/LinkedIn", "TEXT"),
    ("notes2", "Notes2", "TEXT"),
    ("touch_1_date", "Touch 1 Date", "TEXT"),
    ("touch_1_channel", "Touch 1 Channel", "TEXT"),
    ("touch_2_date", "Touch 2 Date", "TEXT"),
    ("touch_2_channel", "Touch 2 Channel", "TEXT"),
    ("touch_3_date", "Touch 3 Date", "TEXT"),
    ("touch_3_channel", "Touch 3 Channel", "TEXT"),
    ("touch_4_date", "Touch 4 Date", "TEXT"),
    ("touch_4_channel", "Touch 4 Channel", "TEXT"),
    ("touch_5_date", "Touch 5 Date", "TEXT"),
    ("touch_5_channel", "Touch 5 Channel", "TEXT"),
    ("touch_6_date", "Touch 6 Date", "TEXT"),
    ("touch_6_channel", "Touch 6 Channel", "TEXT"),
    ("touch_7_date", "Touch 7 Date", "TEXT"),
    ("touch_7_channel", "Touch 7 Channel", "TEXT"),
    ("response_date", "Response Date", "TEXT"),
    ("engaged_date", "Engaged Date", "TEXT"),
]

# DB column names only
DB_COLS = [c[0] for c in LEAD_COLUMNS]
# Map: lowercase sheet header -> db column name
HEADER_MAP = {}
for db_col, sheet_col, _ in LEAD_COLUMNS:
    HEADER_MAP[sheet_col.strip().lower()] = db_col
    HEADER_MAP[db_col] = db_col  # also accept db-style names


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DATABASE)
    cols_sql = ",\n            ".join(
        f"{c[0]} {c[2]}" for c in LEAD_COLUMNS
    )
    db.executescript(
        f"""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            {cols_sql},
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """
    )
    db.commit()
    db.close()


# --- Dashboard ---
@app.route("/")
def dashboard():
    db = get_db()
    total = db.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    by_status = [
        dict(r) for r in db.execute(
            "SELECT status, COUNT(*) as count FROM leads WHERE status != '' GROUP BY status ORDER BY count DESC"
        ).fetchall()
    ]
    by_layer = [
        dict(r) for r in db.execute(
            "SELECT layer, COUNT(*) as count FROM leads WHERE layer != '' GROUP BY layer ORDER BY count DESC"
        ).fetchall()
    ]
    by_component = [
        dict(r) for r in db.execute(
            "SELECT component, COUNT(*) as count FROM leads WHERE component != '' GROUP BY component ORDER BY count DESC"
        ).fetchall()
    ]
    by_state = [
        dict(r) for r in db.execute(
            "SELECT state, COUNT(*) as count FROM leads WHERE state != '' GROUP BY state ORDER BY count DESC LIMIT 15"
        ).fetchall()
    ]
    by_owner = [
        dict(r) for r in db.execute(
            "SELECT owner, COUNT(*) as count FROM leads WHERE owner != '' GROUP BY owner ORDER BY count DESC"
        ).fetchall()
    ]
    engaged = db.execute("SELECT COUNT(*) FROM leads WHERE engaged_date != ''").fetchone()[0]
    responded = db.execute("SELECT COUNT(*) FROM leads WHERE response_date != ''").fetchone()[0]
    warm_intros = db.execute("SELECT COUNT(*) FROM leads WHERE warm_intro != '' AND warm_intro IS NOT NULL AND lower(warm_intro) != 'no'").fetchone()[0]

    # Recent touches: find leads with the most recent touch activity
    recent_touches = [
        dict(r) for r in db.execute(
            """SELECT company_name, contact_name, status,
                      touch_1_date, touch_1_channel,
                      touch_2_date, touch_2_channel,
                      touch_3_date, touch_3_channel,
                      response_date, engaged_date
               FROM leads
               ORDER BY
                   COALESCE(NULLIF(touch_7_date,''), NULLIF(touch_6_date,''), NULLIF(touch_5_date,''),
                            NULLIF(touch_4_date,''), NULLIF(touch_3_date,''), NULLIF(touch_2_date,''),
                            NULLIF(touch_1_date,''), '') DESC
               LIMIT 15"""
        ).fetchall()
    ]

    stats = {
        "total": total,
        "engaged": engaged,
        "responded": responded,
        "warm_intros": warm_intros,
        "by_status": by_status,
        "by_layer": by_layer,
        "by_component": by_component,
        "by_state": by_state,
        "by_owner": by_owner,
        "recent_touches": recent_touches,
    }
    return render_template("dashboard.html", stats=stats)


# --- Leads list ---
@app.route("/leads")
def leads_list():
    db = get_db()
    search = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "").strip()
    layer_filter = request.args.get("layer", "").strip()
    owner_filter = request.args.get("owner", "").strip()

    query = "SELECT * FROM leads WHERE 1=1"
    params = []

    if search:
        query += " AND (company_name LIKE ? OR contact_name LIKE ? OR email LIKE ? OR identifier LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s, s])
    if status_filter:
        query += " AND status = ?"
        params.append(status_filter)
    if layer_filter:
        query += " AND layer = ?"
        params.append(layer_filter)
    if owner_filter:
        query += " AND owner = ?"
        params.append(owner_filter)

    query += " ORDER BY updated_at DESC"
    leads = [dict(r) for r in db.execute(query, params).fetchall()]

    # Get distinct values for filters
    statuses = [r[0] for r in db.execute("SELECT DISTINCT status FROM leads WHERE status != '' ORDER BY status").fetchall()]
    layers = [r[0] for r in db.execute("SELECT DISTINCT layer FROM leads WHERE layer != '' ORDER BY layer").fetchall()]
    owners = [r[0] for r in db.execute("SELECT DISTINCT owner FROM leads WHERE owner != '' ORDER BY owner").fetchall()]

    return render_template(
        "leads.html", leads=leads, columns=LEAD_COLUMNS,
        statuses=statuses, layers=layers, owners=owners,
        search=search, status_filter=status_filter,
        layer_filter=layer_filter, owner_filter=owner_filter,
    )


@app.route("/leads/add", methods=["POST"])
def lead_add():
    db = get_db()
    values = [request.form.get(c[0], "") for c in LEAD_COLUMNS]
    placeholders = ", ".join(["?"] * len(LEAD_COLUMNS))
    cols = ", ".join(DB_COLS)
    db.execute(f"INSERT INTO leads ({cols}) VALUES ({placeholders})", values)
    db.commit()
    return redirect(url_for("leads_list"))


@app.route("/leads/<int:id>/edit", methods=["POST"])
def lead_edit(id):
    db = get_db()
    sets = ", ".join(f"{c}=?" for c in DB_COLS)
    values = [request.form.get(c, "") for c in DB_COLS]
    values.append(id)
    db.execute(f"UPDATE leads SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE id=?", values)
    db.commit()
    return redirect(url_for("leads_list"))


@app.route("/leads/<int:id>/delete", methods=["POST"])
def lead_delete(id):
    db = get_db()
    db.execute("DELETE FROM leads WHERE id=?", (id,))
    db.commit()
    return redirect(url_for("leads_list"))


@app.route("/leads/<int:id>/json")
def lead_json(id):
    db = get_db()
    row = db.execute("SELECT * FROM leads WHERE id=?", (id,)).fetchone()
    if row:
        return jsonify(dict(row))
    return jsonify({"error": "Not found"}), 404


# --- SQL Query Interface ---
@app.route("/query")
def query_page():
    return render_template("query.html")


@app.route("/query/run", methods=["POST"])
def query_run():
    sql = request.json.get("sql", "").strip()
    if not sql:
        return jsonify({"error": "No SQL provided"}), 400

    if not sql.upper().startswith("SELECT"):
        return jsonify({"error": "Only SELECT queries are allowed. Use the UI for modifications."}), 400

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
    return render_template("import.html", columns=LEAD_COLUMNS)


@app.route("/import/csv", methods=["POST"])
def import_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported"}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"))
        reader = csv.DictReader(stream)
        db = get_db()
        imported = 0

        for row in reader:
            mapped = {}
            for csv_col, value in row.items():
                if csv_col is None:
                    continue
                key = csv_col.strip().lower()
                # Try exact header match, then underscore version
                db_col = HEADER_MAP.get(key) or HEADER_MAP.get(key.replace(" ", "_"))
                if db_col:
                    mapped[db_col] = value.strip() if value else ""

            if not mapped or not mapped.get("company_name"):
                continue

            cols = ", ".join(mapped.keys())
            placeholders = ", ".join(["?"] * len(mapped))
            db.execute(
                f"INSERT INTO leads ({cols}) VALUES ({placeholders})",
                list(mapped.values()),
            )
            imported += 1

        db.commit()
        return jsonify({"success": True, "imported": imported})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=8080)
