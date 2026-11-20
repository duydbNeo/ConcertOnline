#!/usr/bin/env python3
"""Event Agent: nhận brief (chủ đề + danh sách bài) và dựng lịch diễn show.json.
Cách dùng: python3 event_agent.py [brief.json] [out show.json]
Dựng theo luật: cue luôn bắt đầu ở đầu ô nhịp, năng lượng lên dần rồi hạ, mọi giá trị nằm trong từ vựng của sân khấu.
Tự kiểm tra trước khi ghi; nếu có lỗi thì không ghi."""
import json, sys, os, copy
D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, '..', 'src', 'show.json')
base = json.load(open(SRC, encoding='utf-8'))
VOC = base['vocabulary']; PALS = base['palettes']
songs = json.load(open(os.path.join(D, 'songs.json'), encoding='utf-8'))
brief = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, 'brief.json'), encoding='utf-8'))
out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(D, 'show.generated.json')
SHOW = brief['cycle']['show']

FULL = ['kick', 'snare', 'bass', 'pad', 'hat', 'arp', 'vocal', 'clap']
# Hình dạng một bài: (tỉ lệ vị trí, đèn, LED, camera, năng lượng, lớp nhạc, hiệu ứng, cổ vũ)
ARC = [
  (0.00, 'cross',    'grid',    'wide',    0.70, ['kick', 'snare', 'bass', 'pad', 'hat'], None, 1.0),
  (0.15, 'spot',     'rings',   'closeup', 0.75, ['kick', 'snare', 'bass', 'pad', 'hat', 'vocal'], None, None),
  (0.35, 'sweep',    'grid',    'stagel',  0.85, ['kick', 'snare', 'bass', 'pad', 'hat', 'arp', 'vocal'], None, None),
  (0.50, 'fan',      'bars',    'crane',   1.00, FULL, 'confetti', 1.0),
  (0.72, 'chase',    'sunburst', 'stager', 1.00, FULL, 'sparks', 1.0),
  (0.90, 'converge', 'bars',    'closeup', 0.90, ['kick', 'snare', 'bass', 'pad', 'arp', 'vocal'], None, None),
]

def bar_sec(song): return 240.0 / song['bpm']
def snap(t, seg, song):
    b = bar_sec(song); k = round((t - seg['start']) / b)
    return round(seg['start'] + k * b, 2)

cues, segs, lib = [], [], {}
for k in ('overture', 'interlude', 'outro'): lib[k] = base['songs'][k]
t = 0.0
def add_seg(sid, song, band, label, length):
    global t
    s = {'id': sid, 'start': round(t, 2), 'end': round(t + length, 2), 'band': band, 'song': song, 'label': label}
    segs.append(s); t += length; return s

ov = add_seg('overture', 'overture', 'none', 'Mở màn', brief['overture'])
cues += [
  {'t': 0, 'pal': 'deep', 'light': 'dim', 'led': 'title', 'text': brief['title'].split(' ', 1) if ' ' in brief['title'] else [brief['title']], 'cam': 'wide', 'energy': 0.3, 'layers': ['pad', 'kick'], 'cheer': 0.4},
  {'t': round(ov['end'] * 0.4, 1), 'pal': 'neon', 'light': 'fan', 'led': 'stars', 'cam': 'crane', 'energy': 0.5, 'layers': ['pad', 'kick', 'hat', 'riser']},
]
band_names = {b['id']: b['name'] for b in json.load(open(os.path.join(D, '..', 'src', 'bands.json'), encoding='utf-8'))['bands']}
n_set = len(brief['setlist'])
for i, it in enumerate(brief['setlist']):
    sdef = copy.deepcopy(songs[it['song']])
    key = it['song'] if it['id'] != 'finale' else it['song'] + '_reprise'
    if it.get('voice'): sdef['voice'] = it['voice']
    lib[key] = sdef
    if i > 0 and it['id'] != 'finale' or (i > 0 and it['id'] == 'finale'):
        mid = 'mc%d' % i
        mlabel = {'mc1': 'Vẫy đèn nào', 'mc2': 'Hai ban nhạc, một đêm'}.get(mid, 'Giao lưu')
        ms = add_seg(mid, 'interlude', 'none', mlabel, brief['interlude'])
        cues.append({'t': ms['start'], 'pal': 'deep', 'light': 'dim', 'led': 'wave', 'text': [x for x in mlabel.upper().split(', ')], 'cam': 'wide', 'energy': 0.45, 'layers': ['pad', 'clap'], 'crowd': 'wave', 'cheer': 0.8})
    seg = add_seg(it['id'], key, it['band'], it['label'], it['len'])
    name = ' x '.join(band_names.values()) if it['band'] == 'both' else band_names[it['band']]
    for j, (f, light, led, cam, en, layers, fx, cheer) in enumerate(ARC):
        tt = snap(seg['start'] + f * it['len'], seg, sdef)
        if j == 0: tt = seg['start']
        c = {'t': tt, 'pal': it['pal'], 'light': ('strobe' if (j == 0 and it['band'] == 'both') else light), 'led': led, 'cam': cam, 'energy': en, 'layers': layers}
        if j == 0: c['text'] = [name] if it['band'] != 'both' else ['SOLAR DRIFT', 'x LUNA VOLT']
        if j == 0: c['led'] = 'sunburst' if it['band'] == 'both' else 'grid'
        if fx: c['fx'] = fx
        if cheer: c['cheer'] = cheer
        if it['id'] == 'finale' and j == 3: c['fx'] = 'fireworks'
        cues.append(c)
ou = add_seg('outro', 'outro', 'both', 'Cảm ơn', brief['outro'])
cues += [
  {'t': ou['start'], 'pal': 'gold', 'light': 'fan', 'led': 'thanks', 'text': ['CẢM ƠN', 'HẸN ĐÊM SAU'], 'cam': 'crane', 'energy': 0.7, 'layers': ['pad', 'arp', 'clap'], 'crowd': 'wave', 'fx': 'fireworks', 'cheer': 1.0},
  {'t': round(ou['start'] + 8, 2), 'pal': 'gold', 'light': 'dim', 'led': 'thanks', 'cam': 'wide', 'energy': 0.4, 'layers': ['pad'], 'fx': 'fireworks', 'cheer': 0.8},
]

# Co/giãn để đủ độ dài buổi diễn
if abs(t - SHOW) > 1e-6:
    sys.exit('LỖI: tổng độ dài các đoạn là %.1fs, cần %ds. Chỉnh len/overture/interlude/outro trong brief.' % (t, SHOW))

# Tự kiểm tra (cùng luật với màn Diễn tập trong game)
errs = []
prev = -1
for c in cues:
    if c['t'] < 0 or c['t'] >= SHOW: errs.append('cue %s ngoài buổi diễn' % c['t'])
    if c['t'] <= prev: errs.append('cue %s không tăng dần' % c['t'])
    prev = c['t']
    for k, v in (('light', VOC['light']), ('led', VOC['led']), ('cam', VOC['cam'])):
        if k in c and c[k] not in v: errs.append('%s "%s" không hợp lệ' % (k, c[k]))
    if 'fx' in c and c['fx'] not in VOC['fx']: errs.append('fx "%s" không hợp lệ' % c['fx'])
    if c['pal'] not in PALS: errs.append('màu "%s" không có' % c['pal'])
    for l in c['layers']:
        if l not in VOC['layers']: errs.append('lớp nhạc "%s" không hợp lệ' % l)
if cues[0]['t'] != 0: errs.append('cue đầu phải ở giây 0')
for s in segs:
    if s['song'] not in {**lib}: errs.append('bài %s thiếu' % s['song'])
    if s['band'] not in VOC['bands']: errs.append('band %s sai' % s['band'])
if errs: sys.exit('LỖI:\n' + '\n'.join(errs))

show = {k: base[k] for k in ('palettes', 'vocabulary')}
show.update({'agent': 'Event Agent', 'title': brief['title'], 'theme': brief['theme'], 'cycle': brief['cycle'],
             'segments': segs, 'cues': cues, 'songs': lib})
# giữ thứ tự khóa như bản cũ
order = ['agent', 'title', 'theme', 'cycle', 'palettes', 'segments', 'cues', 'songs', 'vocabulary']
show = {k: show[k] for k in order}
json.dump(show, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# Bản lịch dễ đọc
def mmss(x): return '%d:%02d' % (int(x) // 60, int(x) % 60)
print('LỊCH DIỄN:', brief['title'], '-', brief['theme'])
for s in segs:
    who = {'none': '', 'solar': band_names['solar'], 'luna': band_names['luna'], 'both': 'cả hai'}[s['band']]
    print('  %s-%s  %-22s %s' % (mmss(s['start']), mmss(s['end']), s['label'], who))
print('Cue:', len(cues), '| đã ghi', out_path)
