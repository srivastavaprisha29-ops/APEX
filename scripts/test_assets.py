import gzip,json,struct,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'dist'
NAMES={'front-wing','chassis','front-left-wheel','front-right-wheel','front-suspension','left-sidepod','right-sidepod','floor','halo','engine-cover','rear-suspension','rear-left-wheel','rear-right-wheel','rear-wing','mirrors','exhaust'}
def read_glb(data):
    assert data[:4]==b'glTF'
    assert struct.unpack_from('<I',data,8)[0]==len(data)
    length=struct.unpack_from('<I',data,12)[0]
    return json.loads(data[20:20+length])
class Assets(unittest.TestCase):
    def test_full_and_preview_have_all_groups(self):
        for file in ['car.glb.gz','car-preview.glb']:
            data=(ROOT/'models'/file).read_bytes()
            if file.endswith('.gz'):data=gzip.decompress(data)
            gltf=read_glb(data)
            names={n.get('name') for n in gltf['nodes'] if 'mesh' in n}
            self.assertEqual(names,NAMES)
            self.assertTrue(all(m.get('primitives') for m in gltf['meshes']))
    def test_attribution_and_asset_limits(self):
        credit=(ROOT/'models/ATTRIBUTION.md').read_text()
        for term in ['Qvist','CC BY 4.0','sketchfab.com','Changes']:self.assertIn(term,credit)
        self.assertLess((ROOT/'models/car.glb.gz').stat().st_size,25*1024*1024)
        self.assertLess((ROOT/'models/car-preview.glb').stat().st_size,2*1024*1024)
if __name__=='__main__':unittest.main()
