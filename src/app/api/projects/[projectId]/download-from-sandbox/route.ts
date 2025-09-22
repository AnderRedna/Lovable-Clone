import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSandbox } from '@/inngest/utils';
import JSZip from 'jszip';

// Arquivos e pastas a serem excluídos
const EXCLUDED_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  '.env.local',
  '.env',
  'dist',
  'build',
  'coverage',
  '.nyc_output',
  '.DS_Store',
  'Thumbs.db',
  '.vscode',
  '.idea',
  '*.log',
  '*.tmp',
  '*.temp',
  'nextjs-app',
  'compile_page.sh',
  'e2b.toml',
  'e2b.Dockerfile',
  '.e2b',
  'README.md',
  'next-env.d.ts',
  'components.json',
  '.bashrc',
  '.profile',
  'package-lock.json',
  'favicon.ico',
  'app/favicon.ico'
];

// Função para verificar se um caminho deve ser excluído
function shouldExclude(path: string): boolean {
  return EXCLUDED_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(path);
    }
    return path.includes(pattern);
  });
}

// Função recursiva para listar todos os arquivos
async function listAllFiles(sandbox: any, dirPath: string = '/home/user'): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const result = await sandbox.commands.run(`find ${dirPath} -type f`);
    
    if (result.exitCode === 0) {
      const allFiles = result.stdout
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => line.trim());
      
      // Filtrar arquivos excluídos
      for (const file of allFiles) {
        if (!shouldExclude(file)) {
          files.push(file);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
  }
  
  return files;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    // Buscar o projeto e o último fragment com sandboxId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        messages: {
          include: {
            fragment: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 });
    }

    const lastMessage = project.messages[0];
    if (!lastMessage?.fragment?.sandboxUrl) {
      return NextResponse.json({ 
        error: 'Sandbox não encontrado. Use o download manual.' 
      }, { status: 404 });
    }

    // Extrair sandboxId da URL do sandbox
    const sandboxUrlMatch = lastMessage.fragment.sandboxUrl.match(/https:\/\/\d+-([^-]+)-[^.]+\.e2b\.(dev|app)/);
    if (!sandboxUrlMatch) {
      return NextResponse.json({ 
        error: 'URL do sandbox inválida' 
      }, { status: 400 });
    }

    const sandboxId = sandboxUrlMatch[1];

    // Conectar ao sandbox
    const sandbox = await getSandbox(sandboxId);
    
    // Listar todos os arquivos do projeto
    const allFiles = await listAllFiles(sandbox, '/home/user');
    
    if (allFiles.length === 0) {
      return NextResponse.json({ 
        error: 'Nenhum arquivo encontrado no projeto' 
      }, { status: 404 });
    }
    
    // Criar ZIP em memória
    const zip = new JSZip();
    
    // Baixar cada arquivo individualmente
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      
      try {
        // Baixar arquivo usando a API oficial do E2B
        const fileContent = await sandbox.files.read(filePath);
        
        if (fileContent) {
          // Remover o prefixo /home/user/ do caminho para o ZIP
          const relativePath = filePath.replace('/home/user/', '');
          
          // Adicionar ao ZIP
          if (typeof fileContent === 'string') {
            zip.file(relativePath, fileContent);
          } else {
            zip.file(relativePath, fileContent);
          }
          successCount++;
        } else {
          errorCount++;
        }
      } catch (fileError) {
        console.error(`Erro ao baixar ${filePath}:`, fileError);
        errorCount++;
        // Continuar com outros arquivos
      }
    }

    // Adicionar favicon padrão ao projeto
    try {
      const fs = require('fs');
      const path = require('path');
      const defaultFaviconPath = path.join(process.cwd(), 'public', 'default-favicon.ico');
      
      if (fs.existsSync(defaultFaviconPath)) {
        const defaultFaviconContent = fs.readFileSync(defaultFaviconPath);
        zip.file('public/favicon.ico', defaultFaviconContent);
        successCount++;
      }
    } catch (faviconError) {
      console.error('Erro ao adicionar favicon padrão:', faviconError);
    }
    
    if (successCount === 0) {
      return NextResponse.json({ 
        error: 'Falha ao baixar arquivos do sandbox' 
      }, { status: 500 });
    }
    
    // Gerar ZIP
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // Retornar o arquivo ZIP
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.name || 'projeto'}-sandbox.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('Erro no download do sandbox:', error);
    
    // Se for erro de conexão com sandbox, sugerir fallback
    if (error.message?.includes('sandbox') || error.message?.includes('connect') || error.message?.includes('timeout')) {
      return NextResponse.json({ 
        error: 'Sandbox indisponível ou timeout. Tente o download manual.',
        fallback: true,
        details: error.message
      }, { status: 503 });
    }

    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    }, { status: 500 });
  }
}