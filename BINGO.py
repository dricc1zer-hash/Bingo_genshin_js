"""Bingo Genshin Impact — application Windows (Tkinter)."""

import csv
import random
import sys
import time
import tkinter as tk
from pathlib import Path
from tkinter import font as tkfont
from tkinter import messagebox, ttk

from PIL import Image, ImageTk

GRID_SIZE = 5
CELLS_COUNT = GRID_SIZE * GRID_SIZE
PLAYER_COLORS = {
    "green": "#2ecc71",
    "red": "#e74c3c",
    "blue": "#3498db",
    "yellow": "#f1c40f",
}
PLAYER_LABELS = {
    "green": "Vert",
    "red": "Rouge",
    "blue": "Bleu",
    "yellow": "Jaune",
}
DEFAULT_PLAYER_COLOR = "green"
COLOR_ORDER = ("green", "red", "blue", "yellow")
LANGUAGES = {
    "Français/French": "Liste_FR.txt",
    "English": "Liste_EN.txt",
}
DEFAULT_LANGUAGE = "Français/French"


def get_app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).parent


APP_DIR = get_app_dir()
CREDITS_FILE = APP_DIR / "Crédits.txt"
TITLE_IMAGE_MAX_SIZE = (280, 280)


def find_title_image() -> Path | None:
    for name in ("Ayaka.png", "ayaka.png"):
        path = APP_DIR / name
        if path.exists():
            return path
    return None


def load_title_image(path: Path) -> ImageTk.PhotoImage:
    image = Image.open(path)
    image.thumbnail(TITLE_IMAGE_MAX_SIZE, Image.Resampling.LANCZOS)
    return ImageTk.PhotoImage(image)


def load_liste(language: str) -> list[dict[str, str]]:
    liste_filename = LANGUAGES.get(language, LANGUAGES[DEFAULT_LANGUAGE])
    liste_file = APP_DIR / liste_filename
    rows: list[dict[str, str]] = []
    with liste_file.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        for line in reader:
            if len(line) < 5:
                continue
            rows.append(
                {
                    "type": line[0].strip(),
                    "proposition": line[1].strip(),
                    "longueur": line[2].strip(),
                    "region": line[3].strip(),
                    "proposition_detaillee": line[4].strip(),
                }
            )
    return rows


class BingoApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Bingo Genshin Impact")
        self.geometry("1100x780")
        self.minsize(900, 650)

        self.language = tk.StringVar(value=DEFAULT_LANGUAGE)
        self.difficulty = tk.StringVar(value="Normal")
        self.longueur_min = tk.StringVar(value="1")
        self.longueur_max = tk.StringVar(value="5")
        self.temps_limite = tk.StringVar(value="30")
        self.points_par_ligne = tk.StringVar(value="3")
        self.chrono_running = False
        self.chrono_start: float | None = None
        self.chrono_elapsed = 0.0
        self.chrono_after_id: str | None = None

        self.grid_texts: list[list[str]] = [[""] * GRID_SIZE for _ in range(GRID_SIZE)]
        self.grid_colors: list[list[frozenset[str]]] = [
            [frozenset() for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)
        ]
        self.cell_frames: list[list[tk.Frame]] = []
        self.cell_canvases: list[list[tk.Canvas]] = []
        self.cell_font: tkfont.Font | None = None
        self.active_color = DEFAULT_PLAYER_COLOR
        self.color_buttons: dict[str, tk.Button] = {}

        self.chrono_label: tk.Label | None = None
        self.grid_container: tk.Frame | None = None
        self.title_photo: ImageTk.PhotoImage | None = None

        self.container = tk.Frame(self)
        self.container.pack(fill=tk.BOTH, expand=True)

        self.screens: dict[str, tk.Frame] = {}
        self._build_main_menu()
        self._build_bingo_screen()
        self._build_settings_screen()
        self._build_credits_screen()
        self.show_screen("main")

    def show_screen(self, name: str) -> None:
        self._on_temps_limite_focus_out()
        self._on_points_par_ligne_focus_out()
        for frame in self.screens.values():
            frame.pack_forget()
        self.screens[name].pack(fill=tk.BOTH, expand=True)
        if name == "bingo":
            self._reset_bingo_screen()

    def _reset_bingo_screen(self) -> None:
        if self.chrono_after_id:
            self.after_cancel(self.chrono_after_id)
            self.chrono_after_id = None
        self.chrono_running = False
        self.chrono_start = None
        self.chrono_elapsed = 0.0
        self._build_empty_grid()
        self._select_color(DEFAULT_PLAYER_COLOR)
        self._update_chrono_display()

    def _try_go_to_main(self) -> None:
        if self.chrono_running:
            messagebox.showwarning(
                "Chronomètre actif",
                "Le chronomètre est en cours. Vous devez d'abord l'arrêter avant de retourner au menu principal."
            )
            return
        self.show_screen("main")

    def _add_back_button(self, parent: tk.Frame) -> None:
        back = tk.Button(
            parent,
            text="Menu principal",
            command=self._try_go_to_main,
            padx=12,
            pady=6,
        )
        back.place(relx=1.0, rely=1.0, anchor=tk.SE, x=-12, y=-12)

    def _build_main_menu(self) -> None:
        frame = tk.Frame(self.container)
        self.screens["main"] = frame

        title_font = tkfont.Font(family="Segoe UI", size=28, weight="bold")
        menu_font = tkfont.Font(family="Segoe UI", size=14)

        tk.Label(frame, text="Bingo Genshin Impact", font=title_font).pack(
            pady=(60, 12)
        )

        image_path = find_title_image()
        if image_path is not None:
            try:
                self.title_photo = load_title_image(image_path)
                tk.Label(frame, image=self.title_photo).pack(pady=(0, 20))
            except OSError:
                self.title_photo = None

        menu = tk.Frame(frame)
        menu.pack(expand=True)

        for label, screen in (
            ("Bingo", "bingo"),
            ("Paramètres", "settings"),
            ("Crédits", "credits"),
        ):
            tk.Button(
                menu,
                text=label,
                font=menu_font,
                width=18,
                pady=8,
                command=lambda s=screen: self.show_screen(s),
            ).pack(pady=10)

        tk.Button(
            menu,
            text="Quitter",
            font=menu_font,
            width=18,
            pady=8,
            command=self.destroy,
        ).pack(pady=10)

    def _build_bingo_screen(self) -> None:
        frame = tk.Frame(self.container)
        self.screens["bingo"] = frame

        header = tk.Frame(frame)
        header.pack(fill=tk.X, padx=12, pady=8)

        title_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        tk.Label(header, text="Bingo", font=title_font).pack(side=tk.LEFT)

        chrono_font = tkfont.Font(family="Consolas", size=18, weight="bold")
        self.chrono_label = tk.Label(
            header, text="Chronomètre : 00:00:00", font=chrono_font, fg="#1a5276"
        )
        self.chrono_label.pack(side=tk.RIGHT)

        controls = tk.Frame(frame)
        controls.pack(fill=tk.X, padx=12, pady=(0, 8))

        tk.Button(controls, text="Commencer", command=self._fill_grid, padx=10, pady=4).pack(
            side=tk.LEFT, padx=4
        )
        tk.Button(
            controls, text="Démarrer chrono", command=self._start_chrono, padx=10, pady=4
        ).pack(side=tk.LEFT, padx=4)
        tk.Button(
            controls, text="Arrêter chrono", command=self._stop_chrono, padx=10, pady=4
        ).pack(side=tk.LEFT, padx=4)

        colors_frame = tk.Frame(controls)
        colors_frame.pack(side=tk.LEFT, padx=(12, 4))
        for color_name, hex_color in PLAYER_COLORS.items():
            btn = tk.Button(
                colors_frame,
                text="",
                width=3,
                height=1,
                bg=hex_color,
                activebackground=hex_color,
                relief=tk.RAISED,
                bd=2,
                highlightthickness=2,
                highlightbackground="#333333",
                command=lambda c=color_name: self._select_color(c),
            )
            btn.pack(side=tk.LEFT, padx=3)
            self.color_buttons[color_name] = btn
        self._update_color_buttons()

        self.grid_container = tk.Frame(frame)
        self.grid_container.pack(fill=tk.BOTH, expand=True, padx=12, pady=(0, 48))
        self._build_empty_grid()

        self._add_back_button(frame)

    def _build_empty_grid(self) -> None:
        assert self.grid_container is not None
        for child in self.grid_container.winfo_children():
            child.destroy()

        self.cell_frames = []
        self.cell_canvases = []
        self.grid_colors = [[frozenset() for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        self.grid_texts = [[""] * GRID_SIZE for _ in range(GRID_SIZE)]

        self.cell_font = tkfont.Font(family="Segoe UI", size=9)

        for row in range(GRID_SIZE):
            row_frames: list[tk.Frame] = []
            row_canvases: list[tk.Canvas] = []
            self.grid_container.rowconfigure(row, weight=1)
            for col in range(GRID_SIZE):
                self.grid_container.columnconfigure(col, weight=1)
                cell = tk.Frame(
                    self.grid_container,
                    bg="white",
                    highlightbackground="#999",
                    highlightthickness=1,
                )
                cell.grid(row=row, column=col, sticky="nsew", padx=2, pady=2)

                canvas = tk.Canvas(
                    cell,
                    bg="white",
                    highlightthickness=0,
                    bd=0,
                    cursor="hand2",
                )
                canvas.pack(fill=tk.BOTH, expand=True)
                canvas.bind(
                    "<Button-1>",
                    lambda _e, r=row, c=col: self._toggle_cell(r, c),
                )
                canvas.bind(
                    "<Configure>",
                    lambda _e, r=row, c=col: self._redraw_cell(r, c),
                )

                row_frames.append(cell)
                row_canvases.append(canvas)

            self.cell_frames.append(row_frames)
            self.cell_canvases.append(row_canvases)

    def _select_color(self, color_name: str) -> None:
        self.active_color = color_name
        self._update_color_buttons()

    def _update_color_buttons(self) -> None:
        for color_name, button in self.color_buttons.items():
            if color_name == self.active_color:
                button.config(
                    relief=tk.SUNKEN,
                    highlightthickness=3,
                    highlightbackground="#000000",
                )
            else:
                button.config(
                    relief=tk.RAISED,
                    highlightthickness=2,
                    highlightbackground="#333333",
                )

    def _ordered_cell_colors(self, colors: frozenset[str]) -> list[str]:
        return [name for name in COLOR_ORDER if name in colors]

    def _draw_color_regions(
        self, canvas: tk.Canvas, color_list: list[str], width: int, height: int
    ) -> None:
        if not color_list:
            canvas.create_rectangle(0, 0, width, height, fill="white", outline="")
            return

        if len(color_list) == 1:
            canvas.create_rectangle(
                0, 0, width, height, fill=PLAYER_COLORS[color_list[0]], outline=""
            )
            return

        if len(color_list) == 2:
            c0, c1 = color_list
            canvas.create_polygon(
                0, 0, width, 0, 0, height, fill=PLAYER_COLORS[c0], outline=""
            )
            canvas.create_polygon(
                width, 0, width, height, 0, height, fill=PLAYER_COLORS[c1], outline=""
            )
            return

        if len(color_list) == 3:
            c0, c1, c2 = color_list
            mid_x, mid_y = width / 2, height / 2
            canvas.create_polygon(
                0, 0, width, 0, 0, height, fill=PLAYER_COLORS[c0], outline=""
            )
            canvas.create_polygon(
                width,
                0,
                width,
                height,
                mid_x,
                mid_y,
                fill=PLAYER_COLORS[c1],
                outline="",
            )
            canvas.create_polygon(
                width,
                height,
                0,
                height,
                mid_x,
                mid_y,
                fill=PLAYER_COLORS[c2],
                outline="",
            )
            return

        c0, c1, c2, c3 = color_list
        mid_x, mid_y = width / 2, height / 2
        canvas.create_polygon(
            0, 0, width, 0, mid_x, mid_y, fill=PLAYER_COLORS[c0], outline=""
        )
        canvas.create_polygon(
            width, 0, width, height, mid_x, mid_y, fill=PLAYER_COLORS[c1], outline=""
        )
        canvas.create_polygon(
            width, height, 0, height, mid_x, mid_y, fill=PLAYER_COLORS[c2], outline=""
        )
        canvas.create_polygon(
            0, height, 0, 0, mid_x, mid_y, fill=PLAYER_COLORS[c3], outline=""
        )

    def _redraw_cell(self, row: int, col: int) -> None:
        canvas = self.cell_canvases[row][col]
        width = canvas.winfo_width()
        height = canvas.winfo_height()
        if width < 2 or height < 2:
            return

        canvas.delete("all")
        color_list = self._ordered_cell_colors(self.grid_colors[row][col])
        self._draw_color_regions(canvas, color_list, width, height)

        text = self.grid_texts[row][col]
        if text and self.cell_font is not None:
            canvas.create_text(
                width / 2,
                height / 2,
                text=text,
                width=max(width - 10, 20),
                font=self.cell_font,
                fill="black",
                justify=tk.CENTER,
            )

    def _apply_cell_colors(self, row: int, col: int, colors: frozenset[str]) -> None:
        self.grid_colors[row][col] = colors
        self._redraw_cell(row, col)

    def _proposition_column(self) -> str:
        if self.difficulty.get() == "Facile":
            return "proposition_detaillee"
        return "proposition"

    def _filter_entries_by_length(
        self, entries: list[dict[str, str]]
    ) -> list[dict[str, str]]:
        min_len = int(self.longueur_min.get())
        max_len = int(self.longueur_max.get())
        filtered: list[dict[str, str]] = []
        for entry in entries:
            try:
                length = int(entry["longueur"])
            except ValueError:
                continue
            if min_len <= length <= max_len:
                filtered.append(entry)
        return filtered

    def _fill_grid(self) -> None:
        try:
            entries = load_liste(self.language.get())
        except OSError as exc:
            liste_filename = LANGUAGES.get(self.language.get(), LANGUAGES[DEFAULT_LANGUAGE])
            messagebox.showerror("Erreur", f"Impossible de lire {liste_filename} :\n{exc}")
            return

        entries = self._filter_entries_by_length(entries)

        if len(entries) < CELLS_COUNT:
            messagebox.showerror(
                "Erreur",
                f"Pas assez de propositions pour les critères choisis "
                f"(longueur {self.longueur_min.get()} à {self.longueur_max.get()}).\n"
                f"Il en faut au moins {CELLS_COUNT}, actuellement {len(entries)}.",
            )
            return

        column = self._proposition_column()
        selected = random.sample(entries, CELLS_COUNT)

        self._build_empty_grid()

        index = 0
        for row in range(GRID_SIZE):
            for col in range(GRID_SIZE):
                text = selected[index][column]
                self.grid_texts[row][col] = text
                self._redraw_cell(row, col)
                index += 1

    def _toggle_cell(self, row: int, col: int) -> None:
        if not self.chrono_running:
            messagebox.showinfo("Chronomètre", "Le chronomètre doit être démarré")
            return
        if not self.grid_texts[row][col]:
            return

        colors = set(self.grid_colors[row][col])
        active = self.active_color
        if active in colors:
            colors.discard(active)
        else:
            colors.add(active)
        self._apply_cell_colors(row, col, frozenset(colors))

    def _get_elapsed_seconds(self) -> float:
        if self.chrono_running and self.chrono_start is not None:
            return self.chrono_elapsed + (time.perf_counter() - self.chrono_start)
        return self.chrono_elapsed

    def _get_temps_limite_seconds(self) -> float | None:
        value = self.temps_limite.get().strip()
        if not value:
            return None
        try:
            minutes = int(value)
        except ValueError:
            return None
        if minutes <= 0:
            return None
        return minutes * 60

    def _on_temps_limite_focus_out(self, _event: tk.Event | None = None) -> None:
        if not self.temps_limite.get().strip():
            self.temps_limite.set("30")

    def _on_points_par_ligne_focus_out(self, _event: tk.Event | None = None) -> None:
        if not self.points_par_ligne.get().strip():
            self.points_par_ligne.set("3")

    def _get_points_par_ligne(self) -> int:
        self._on_points_par_ligne_focus_out()
        try:
            return int(self.points_par_ligne.get().strip())
        except ValueError:
            self.points_par_ligne.set("3")
            return 3

    def _ensure_temps_limite_valid(self) -> bool:
        value = self.temps_limite.get().strip()
        if not value:
            messagebox.showerror("Paramètres", "Le temps limite ne peut pas être vide.")
            self.temps_limite.set("30")
            return False
        try:
            minutes = int(value)
        except ValueError:
            messagebox.showerror(
                "Paramètres", "Le temps limite doit être un nombre entier."
            )
            self.temps_limite.set("30")
            return False
        if minutes <= 0:
            messagebox.showerror(
                "Paramètres", "Le temps limite doit être supérieur à 0."
            )
            self.temps_limite.set("30")
            return False
        return True

    def _show_result_popup(self) -> None:
        bonus_per_line = self._get_points_par_ligne()
        player_lines: list[str] = []

        for color_name, label in PLAYER_LABELS.items():
            cells = self._count_cells_for_color(color_name)
            complete_lines = self._count_complete_lines_for_color(color_name)
            bonus = complete_lines * bonus_per_line
            total = cells + bonus
            player_lines.append(
                f"Joueur {label} : {total} points\n"
                f"  ({cells} cases + {complete_lines} ligne(s)/col/diag × {bonus_per_line})"
            )

        messagebox.showinfo(
            "Résultat",
            f"Temps : {self._format_time(self.chrono_elapsed)}\n\n"
            + "\n\n".join(player_lines),
        )

    def _finalize_chrono(self, *, cap_at_limit: bool = False) -> None:
        if self.chrono_start is not None:
            self.chrono_elapsed += time.perf_counter() - self.chrono_start
        if cap_at_limit:
            limit = self._get_temps_limite_seconds()
            if limit is not None:
                self.chrono_elapsed = min(self.chrono_elapsed, limit)
        self.chrono_running = False
        self.chrono_start = None
        if self.chrono_after_id:
            self.after_cancel(self.chrono_after_id)
            self.chrono_after_id = None
        self._update_chrono_display()
        self._show_result_popup()

    def _format_time(self, seconds: float) -> str:
        total = int(seconds)
        hours, remainder = divmod(total, 3600)
        minutes, secs = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def _update_chrono_display(self) -> None:
        if self.chrono_label is None:
            return
        elapsed = self._get_elapsed_seconds()
        self.chrono_label.config(text=f"Chronomètre : {self._format_time(elapsed)}")

    def _tick_chrono(self) -> None:
        self._update_chrono_display()
        if not self.chrono_running:
            return
        limit = self._get_temps_limite_seconds()
        if limit is not None and self._get_elapsed_seconds() >= limit:
            self._finalize_chrono(cap_at_limit=True)
            return
        self.chrono_after_id = self.after(100, self._tick_chrono)

    def _start_chrono(self) -> None:
        if self.chrono_running:
            return
        if not self._ensure_temps_limite_valid():
            return
        self.chrono_running = True
        self.chrono_start = time.perf_counter()
        if self.chrono_after_id:
            self.after_cancel(self.chrono_after_id)
        self._tick_chrono()

    def _cell_has_color(self, row: int, col: int, color_name: str) -> bool:
        return color_name in self.grid_colors[row][col]

    def _count_cells_for_color(self, color_name: str) -> int:
        return sum(
            1
            for row in range(GRID_SIZE)
            for col in range(GRID_SIZE)
            if self._cell_has_color(row, col, color_name)
        )

    def _count_complete_lines_for_color(self, color_name: str) -> int:
        count = 0
        for row in range(GRID_SIZE):
            if all(
                self._cell_has_color(row, col, color_name) for col in range(GRID_SIZE)
            ):
                count += 1
        for col in range(GRID_SIZE):
            if all(
                self._cell_has_color(row, col, color_name) for row in range(GRID_SIZE)
            ):
                count += 1
        if all(self._cell_has_color(i, i, color_name) for i in range(GRID_SIZE)):
            count += 1
        if all(
            self._cell_has_color(i, GRID_SIZE - 1 - i, color_name)
            for i in range(GRID_SIZE)
        ):
            count += 1
        return count

    def _stop_chrono(self) -> None:
        if not self.chrono_running:
            messagebox.showinfo("Chronomètre", "Le chronomètre n'est pas démarré.")
            return
        self._finalize_chrono()

    def _reset_settings_to_defaults(self) -> None:
        self.language.set(DEFAULT_LANGUAGE)
        self.difficulty.set("Normal")
        self.longueur_min.set("1")
        self.longueur_max.set("5")
        self.temps_limite.set("30")
        self.points_par_ligne.set("3")

    def _build_settings_screen(self) -> None:
        frame = tk.Frame(self.container)
        self.screens["settings"] = frame

        title_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        tk.Label(frame, text="Paramètres", font=title_font).pack(pady=(40, 30))

        form = tk.Frame(frame)
        form.pack(pady=20)

        tk.Label(form, text="Langue :", font=("Segoe UI", 12)).grid(
            row=0, column=0, sticky=tk.W, padx=8, pady=12
        )
        ttk.Combobox(
            form,
            textvariable=self.language,
            values=list(LANGUAGES.keys()),
            state="readonly",
            width=20,
        ).grid(row=0, column=1, padx=8, pady=12)

        tk.Label(form, text="Difficulté :", font=("Segoe UI", 12)).grid(
            row=1, column=0, sticky=tk.W, padx=8, pady=12
        )
        combo = ttk.Combobox(
            form,
            textvariable=self.difficulty,
            values=["Normal", "Facile"],
            state="readonly",
            width=20,
        )
        combo.grid(row=1, column=1, padx=8, pady=12)

        tk.Label(form, text="Longueur Min :", font=("Segoe UI", 12)).grid(
            row=2, column=0, sticky=tk.W, padx=8, pady=12
        )
        ttk.Combobox(
            form,
            textvariable=self.longueur_min,
            values=["1", "2"],
            state="readonly",
            width=20,
        ).grid(row=2, column=1, padx=8, pady=12)

        tk.Label(form, text="Longueur Max :", font=("Segoe UI", 12)).grid(
            row=3, column=0, sticky=tk.W, padx=8, pady=12
        )
        ttk.Combobox(
            form,
            textvariable=self.longueur_max,
            values=["3", "4", "5"],
            state="readonly",
            width=20,
        ).grid(row=3, column=1, padx=8, pady=12)

        tk.Label(form, text="Temps limite en Min :", font=("Segoe UI", 12)).grid(
            row=4, column=0, sticky=tk.W, padx=8, pady=12
        )
        temps_entry = ttk.Entry(
            form, textvariable=self.temps_limite, width=22, justify=tk.CENTER
        )
        temps_entry.grid(row=4, column=1, padx=8, pady=12)
        temps_entry.bind("<FocusOut>", self._on_temps_limite_focus_out)

        tk.Label(
            form, text="Nombre de points pour ligne/Col/diag :", font=("Segoe UI", 12)
        ).grid(row=5, column=0, sticky=tk.W, padx=8, pady=12)
        points_entry = ttk.Entry(
            form, textvariable=self.points_par_ligne, width=22, justify=tk.CENTER
        )
        points_entry.grid(row=5, column=1, padx=8, pady=12)
        points_entry.bind("<FocusOut>", self._on_points_par_ligne_focus_out)

        tk.Button(
            form,
            text="Par défaut",
            command=self._reset_settings_to_defaults,
            padx=12,
            pady=6,
        ).grid(row=6, column=0, columnspan=2, pady=(20, 8))

        hint = (
            "Langue : choisir entre Français et English pour charger la liste appropriée.\n\n"
            "La difficulté Facile ajoutera la région.\n\n"
            "Longueur Min / Max : seules les lignes dont le champ "
            "« Longueur 1 à 5 » est compris entre ces valeurs seront utilisées.\n\n"
            "Temps limite en Min : durée maximale de la partie. À l'expiration, "
            "le chronomètre s'arrête et le résultat s'affiche.\n\n"
            "Nombre de points pour ligne/Col/diag : bonus par ligne, colonne ou "
            "diagonale complète d'une même couleur, ajouté au score de chaque joueur."
        )
        tk.Label(frame, text=hint, justify=tk.LEFT, fg="#555").pack(pady=20)

        self._add_back_button(frame)

    def _build_credits_screen(self) -> None:
        frame = tk.Frame(self.container)
        self.screens["credits"] = frame

        title_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        tk.Label(frame, text="Crédits", font=title_font).pack(pady=(40, 20))

        text_frame = tk.Frame(frame)
        text_frame.pack(fill=tk.BOTH, expand=True, padx=40, pady=(0, 48))

        scrollbar = tk.Scrollbar(text_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        text_widget = tk.Text(
            text_frame,
            wrap=tk.WORD,
            font=("Segoe UI", 12),
            yscrollcommand=scrollbar.set,
            state=tk.DISABLED,
            padx=12,
            pady=12,
        )
        text_widget.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=text_widget.yview)

        try:
            content = CREDITS_FILE.read_text(encoding="utf-8")
        except OSError as exc:
            content = f"Impossible de lire Crédits.txt :\n{exc}"

        text_widget.config(state=tk.NORMAL)
        text_widget.insert(tk.END, content)
        text_widget.config(state=tk.DISABLED)

        self._add_back_button(frame)


def main() -> None:
    app = BingoApp()
    app.mainloop()


if __name__ == "__main__":
    main()
