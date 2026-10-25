# Room Viewer

**Room Viewer 1.0 · Build 1101 OB** — a desktop 3D editor for creating, viewing, and customizing rooms and interior scenes on Windows. The application combines room and floor management, objects, materials, lighting, and basic physics simulation in a single interface.

**Platform:** Windows 10/11 x64 · **Status:** Old Build (OB) · **Graphics:** WebGL 2.0 · **Source Technologies:** Electron, HTML/CSS/JavaScript.

**Download the ready-to-use build:** [GitHub Releases](https://github.com/Regevedy/Room-Viewer/releases) (once the release is published).

## Features

### Room Creation and Editing

- Predefined room types: empty room, living room, bedroom, kitchen, bathroom, and office.
- Add and connect rooms; organize scenes by levels (floors).
- Furniture and architectural elements catalog: table, chair, sofa, bed, lamp, cabinet, door, and window.
- Geometric primitives: cube, sphere, cylinder, cone, torus, and plane.
- Object hierarchy, scene element selection, property editing, object visibility, and locking.
- Move, rotate, scale, and orientation tools; point editing mode.
- Grid and snapping for accurate placement; undo and redo operations.

### Rendering and Materials

- Custom WebGL 2.0 renderer with a perspective camera and interactive viewport.
- Material settings for color, transparency, metalness, roughness, and emission.
- Procedural GPU texture maps for Albedo, Normal, and Mix/Roughness, without downloading files from the internet.
- Material presets: brick, wood, stone, metal, fabric, glass, sand, grass, and a basic material.
- Lighting and day/night controls; exposure, contrast, saturation, and vignette settings.
- Simplified bloom effect for bright areas and optional grid display.
- Stereoscopic mode with two viewpoints and equirectangular 360° panoramas.

### Environment and Physics

- Atmospheric effects: rain, snow, and fog; additional simple effects such as a glowing object or water surface.
- Object physics simulation: gravity, mass, collision restitution, and friction; simulation state reset.
- Position, rotation, and physics settings for individual objects.

> **Open Beta Limitations:** Not every interface option is fully implemented. Complete shadow maps, SSAO, ray tracing, and global illumination are marked as under development. Wind, thunderstorms, and some particle effects are also not yet implemented. The physics system is intended for interactive scene editing, not engineering calculations.

## Quick Start: Windows Portable Build

1. Open [Releases](https://github.com/Regevedy/Room-Viewer/releases) and find **v1.0.1101-OB**.
2. Download `Room_Viewer_1.0_Build_1101_OB_Windows_x64_Portable.zip`.
3. Extract the entire archive into a separate folder.
4. Launch `Room Viewer.exe` from the `Room Viewer 1.0 Build 1101 OB` directory.

**Important:** The EXE cannot be moved by itself: the accompanying files and the `resources` directory are required. This is a portable, extracted build, **not an installer**. WebGL 2.0-compatible graphics hardware is required. The packaged EXE has not been independently tested on a physical Windows PC with every possible GPU configuration.

## Interface and Controls

| Action | Control |
| --- | --- |
| Orbit the camera around the scene | Left Mouse Button + Drag |
| Pan the camera | Right Mouse Button + Drag |
| Zoom in or out | Mouse Wheel |
| Select an object | Click the object |
| Activate object selection | `Q` |
| Move | `G` |
| Rotate | `R` |
| Scale | `S` |
| Delete the selected object | `Delete` |
| Undo / Redo | `Alt+Z` / `Alt+Y` |

The left panel contains **Catalog**, **Scene**, and **Levels** tabs. The central area displays the 3D viewport, while the right panel shows the selected object's properties. The top toolbar provides scene, physics, material, weather, camera, and display tools. Complete built-in guidance is available through **Help**.

## Projects and Saving

The **File** menu provides **New Project**, **Open**, **Save**, **Save As**, and **Export Scene**.

The primary project format is **`.rvproj`**, a versioned application format. Scene export generates a separate **JSON** file intended for sharing scene data; it is **not** equivalent to saving a complete project.

Keeping backup copies of `.rvproj` files is recommended before moving projects between application versions.

## Running from Source

**Requirements:** Node.js 18+ and npm. Build Windows binaries on Windows 10/11 x64.

```bash
npm ci
npm start
```

Windows build commands:

```powershell
npm run build:installer
npm run build:portable
```

You can also use `START.bat` to run from source or `BUILD_WINDOWS.bat` to build on Windows. Build artifacts are created in `dist/` and are not included in the Git repository. The `build:portable` and `build:installer` commands generate electron-builder artifacts whose formats differ from the prepackaged full-directory ZIP available in Releases.

## Source Structure

```text
Room-Viewer/
├── src/
│   ├── index.html          # Interface and WebGL editor
│   ├── main.js             # Electron main process
│   ├── preload.js          # Restricted Electron ↔ UI bridge
│   ├── physics.js          # Physics module
│   └── project-codec.js    # Project serialization and validation
├── assets/
│   ├── icon.ico            # Windows icon
│   └── icon.png            # Application icon
├── AUTHORS.md              # Authorship and maintenance
├── LICENSE                 # MIT License
├── README.md               # Project documentation
├── package.json            # Electron and build configuration
├── package-lock.json       # Locked dependencies
├── START.bat               # Launch on Windows
└── BUILD_WINDOWS.bat       # Build on Windows
```

The main repository intentionally excludes test suites, audit reports, patches, and bug-fix history. The ready-to-run executable archive is distributed exclusively through GitHub Releases.

## Technical Details

- **Electron 28** — desktop application with context isolation and file-dialog access through a restricted preload/API bridge.
- **JavaScript + HTML/CSS** — application interface and logic.
- **WebGL 2.0** — 3D scene rendering.
- **Three.js** is listed among the project's dependencies; the graphics code also includes a custom renderer.
- **`.rvproj`** projects can be saved and opened locally without a remote server.

## Authors and License

**Original author (according to source metadata):** 3D Room Viewer Studio.  
**GitHub publication and maintenance:** Dam4 — [@Regevedy](https://github.com/Regevedy).  
**Copyright:** © 2026 3D Room Viewer Studio.

See [AUTHORS.md](AUTHORS.md) for details.

The source code is distributed under the **MIT License**. Use, modification, and redistribution are permitted provided the copyright notice and license text are preserved. The software is provided **without warranties**. See [LICENSE](LICENSE) for the complete legal terms.

Electron, Chromium, Three.js, and other third-party components are subject to their respective licenses.

---

**Room Viewer 1.0 · Build 1101 OB** · **2026**  
[Releases](https://github.com/Regevedy/Room-Viewer/releases) · [Report an Issue](https://github.com/Regevedy/Room-Viewer/issues)
