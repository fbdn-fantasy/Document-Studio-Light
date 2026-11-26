"""PDFium, image and Word document import integration tests."""
import importlib.util, json, shutil, tempfile, unittest, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('worker',Path(__file__).with_name('worker.py'));worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)

class ImportTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
 def tearDown(self):self.temp.cleanup()
 def fixture(self,name='digital.pdf',encrypted=False):
  p=self.root/name;fixture=Path(__file__).resolve().parent.parent/'test'/'import-evidence'/'inputs'/('encrypted.pdf' if encrypted else 'digital.pdf');shutil.copyfile(fixture,p);return p
 def test_digital_geometry_text_graphics_and_archive(self):
  path=self.fixture();before=path.read_bytes();pages,sources=worker.process_inputs([str(path)],self.root)
  self.assertEqual(len(pages),2);self.assertTrue(all(p['method']=='pdf-text' for p in pages));self.assertIn('Native selectable',str(pages[0]['blocks']))
  self.assertNotEqual(pages[0]['width'],pages[1]['width']);self.assertEqual(path.read_bytes(),before)
  project=worker.project_for(pages,'Fixture');output=self.root/'result.docx';worker.build_docx(pages,output,project)
  validation=worker.validate_output(output,pages);self.assertEqual(validation['missingTextBlocks'],0);self.assertEqual(validation['pageSections'],2)
  with zipfile.ZipFile(output) as z:self.assertIn('document-studio/project.json',z.namelist())
  self.assertIn('ds-import-page',project['html']);self.assertIn('font-weight:bold',project['html'])
 def test_encrypted_pdf_fails_cleanly(self):
  with self.assertRaisesRegex(ValueError,'password protected'):worker.process_inputs([str(self.fixture(encrypted=True))],self.root)
 def test_malformed_pdf_fails_cleanly(self):
  p=self.root/'broken.pdf';p.write_bytes(b'%PDF-1.7 damaged')
  with self.assertRaisesRegex(ValueError,'damaged'):worker.process_inputs([str(p)],self.root)
 def test_unsupported_extension(self):
  p=self.root/'not.exe';p.write_bytes(b'no')
  with self.assertRaisesRegex(ValueError,'Unsupported'):worker.process_inputs([str(p)],self.root)
 def test_ruled_table_cells_remain_editable(self):
  pages,_=worker.process_inputs([str(self.fixture())],self.root)
  table=next(b for b in pages[0]['blocks'] if b['type']=='table')
  self.assertEqual((table['rows'],table['cols']),(3,2))
  self.assertIn('12 cm',[cell['text'] for cell in table['cells']])
 def test_image_only_pages_preserve_art(self):
  from PIL import Image
  source=self.root/'image.tiff'
  im=Image.new('RGB',(180,240),'white')
  im.save(source,save_all=True,append_images=[im],dpi=(96,96))
  pages,_=worker.process_inputs([str(source)],self.root)
  self.assertEqual(len(pages),2)
  self.assertTrue(all(p['method']=='image' and not p['blocks'] for p in pages))
  output=self.root/'result.docx';worker.build_docx(pages,output,worker.project_for(pages,'Images'))
  self.assertEqual(worker.validate_output(output,pages)['pageSections'],2)
 def test_scanned_pdf_remains_artwork(self):
  path=Path(__file__).resolve().parent.parent/'test/import-evidence/inputs/scanned.pdf'
  pages,_=worker.process_inputs([str(path)],self.root)
  self.assertEqual(pages[0]['method'],'image')
  self.assertFalse(pages[0]['blocks'])
  self.assertTrue(pages[0]['background'].startswith('data:image/png;base64,'))

if __name__=='__main__':unittest.main()
